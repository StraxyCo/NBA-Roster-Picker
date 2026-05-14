"""
Scrapes every NBA player ever listed on Basketball Reference and builds a JSON
file mapping each known nickname -> {player_id, player_name}.

Two-phase approach:
  Phase 1 — scrape the 26 A-Z listing pages to collect every player's ID/name.
  Phase 2 — fetch each player's individual page and extract the "Nicknames:" FAQ
             section (e.g. "Larry Legend, The Hick from French Lick, ...").

A local cache file (scripts/.nickname_cache.json) stores already-fetched pages
so the script can be safely interrupted and re-run without re-fetching.

Output: public/nicknames.json

NOTE: The output JSON should be reviewed and cleaned up by an AI agent after generation.
Potential issues to address include: duplicate or near-duplicate nicknames, nicknames that
are overly generic (e.g. shared by many players), malformed entries, or nicknames that are
just descriptions rather than actual nicknames.
"""

import json
import re
import string
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

BREF_BASE = "https://www.basketball-reference.com"
OUTPUT = Path(__file__).parent.parent / "public" / "nicknames.json"
CACHE_FILE = Path(__file__).parent / ".nickname_cache.json"
PLAYER_LIST_CACHE = Path(__file__).parent / ".player_list_cache.json"
DELAY = 3.0          # seconds between requests
RETRY_DELAY = 60.0   # seconds to wait after a 429/503


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = (
        "Mozilla/5.0 (compatible; nba-roster-picker-research/1.0)"
    )
    return s


# ---------------------------------------------------------------------------
# Phase 1 – collect all players from A-Z listing pages
# ---------------------------------------------------------------------------

def slug_from_href(href: str) -> str:
    return Path(href).stem


def fetch_letter(session: requests.Session, letter: str) -> List[Tuple[str, str]]:
    """Return list of (player_id, player_name) for one letter."""
    url = f"{BREF_BASE}/players/{letter}/"
    resp = session.get(url, timeout=15)
    resp.raise_for_status()
    resp.encoding = "utf-8"

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", id="players")
    if table is None:
        return []

    results = []
    for row in table.find("tbody").find_all("tr"):
        if row.get("class") and "thead" in row.get("class"):
            continue
        name_cell = row.find("th", {"data-stat": "player"})
        if not name_cell:
            continue
        link = name_cell.find("a")
        if not link:
            continue
        player_id = slug_from_href(link["href"])
        raw_name = re.sub(r"\s*\([^)]*\)", "", name_cell.get_text(strip=True)).strip()
        player_name = raw_name.rstrip("*")  # strip Hall of Fame asterisk
        results.append((player_id, player_name))

    return results


def collect_all_players(session: requests.Session) -> List[Tuple[str, str]]:
    if PLAYER_LIST_CACHE.exists():
        data = json.loads(PLAYER_LIST_CACHE.read_text(encoding="utf-8"))
        print(f"Player list loaded from cache: {len(data)} players\n")
        return [tuple(p) for p in data]

    all_players = []
    letters = list(string.ascii_lowercase)
    for i, letter in enumerate(letters):
        print(f"[{i+1:02d}/26] /players/{letter}/ ...", end=" ", flush=True)
        try:
            players = fetch_letter(session, letter)
            all_players.extend(players)
            print(f"{len(players)} players")
        except Exception as e:
            print(f"ERROR: {e}", file=sys.stderr)
        if i < len(letters) - 1:
            time.sleep(DELAY)

    print(f"Total: {len(all_players)} players\n")
    PLAYER_LIST_CACHE.write_text(json.dumps(all_players), encoding="utf-8")
    return all_players


# ---------------------------------------------------------------------------
# Phase 2 – fetch nicknames from individual player pages
# ---------------------------------------------------------------------------

def extract_nicknames(html: str) -> List[str]:
    """
    Find the FAQ block:
      <h3>What are [name]'s nicknames?</h3>
      <p>Nick1, Nick2, Nick3 are nicknames for [name].</p>
    Returns a list of individual nickname strings, or [] if none found.
    """
    soup = BeautifulSoup(html, "html.parser")
    for h3 in soup.find_all("h3"):
        if "nickname" in h3.get_text().lower():
            p = h3.find_next_sibling("p")
            if p:
                text = p.get_text(strip=True)
                # Strip trailing "are nicknames for Name."
                text = re.sub(r"\s+(is|are) a? ?nicknames? for .+$", "", text, flags=re.IGNORECASE)
                nicknames = [n.strip() for n in text.split(",") if n.strip()]
                return nicknames
    return []


def fetch_player_nicknames(
    session: requests.Session,
    player_id: str,
    cache: Dict[str, List[str]],
) -> List[str]:
    if player_id in cache:
        return cache[player_id]

    letter = player_id[0]
    url = f"{BREF_BASE}/players/{letter}/{player_id}.html"
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code in (429, 503):
                print(f"\n  Rate limited ({resp.status_code}), waiting {RETRY_DELAY}s ...", flush=True)
                time.sleep(RETRY_DELAY)
                continue
            resp.raise_for_status()
            resp.encoding = "utf-8"
            nicknames = extract_nicknames(resp.text)
            cache[player_id] = nicknames
            return nicknames
        except requests.RequestException as e:
            if attempt == 2:
                print(f"\n  Failed {player_id}: {e}", file=sys.stderr)
            time.sleep(2)

    cache[player_id] = []
    return []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    session = make_session()

    # Phase 1
    print("=== Phase 1: collecting player list ===")
    all_players = collect_all_players(session)

    # Load resume cache
    cache: Dict[str, List[str]] = {}
    if CACHE_FILE.exists():
        cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        already_done = sum(1 for pid, _ in all_players if pid in cache)
        print(f"Resume cache loaded: {len(cache)} entries ({already_done}/{len(all_players)} players already fetched)")

    # Phase 2
    print("=== Phase 2: fetching nicknames from individual pages ===")
    total = len(all_players)
    for i, (player_id, player_name) in enumerate(all_players):
        in_cache = player_id in cache
        nicknames = fetch_player_nicknames(session, player_id, cache)

        tag = "(cached)" if in_cache else f"-> {nicknames if nicknames else 'none'}"
        print(f"  [{i+1:04d}/{total}] {player_name} ({player_id}) {tag}", flush=True)

        # Save cache periodically
        if not in_cache and (i + 1) % 50 == 0:
            CACHE_FILE.write_text(json.dumps(cache), encoding="utf-8")

        if not in_cache:
            time.sleep(DELAY)

    # Final cache save
    CACHE_FILE.write_text(json.dumps(cache), encoding="utf-8")

    # Build output table: nickname -> list of {player_id, player_name}
    # Every player is indexed by their full name; nicknames are added on top.
    table: Dict[str, List[dict]] = {}
    for player_id, player_name in all_players:
        entry = {"player_id": player_id, "player_name": player_name}
        table.setdefault(player_name, []).append(entry)
        for nick in cache.get(player_id, []):
            if nick and nick != player_name:
                table.setdefault(nick, []).append(entry)

    print(f"\nTotal nickname keys: {len(table)}")
    OUTPUT.write_text(json.dumps(table, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Written to {OUTPUT}")


if __name__ == "__main__":
    main()
