// All 30 NBA teams with BallDontLie API IDs and logo file slugs
export const NBA_TEAMS = [
  { id: 1,  name: "Atlanta Hawks",          abbr: "ATL", slug: "atlanta-hawks" },
  { id: 2,  name: "Boston Celtics",         abbr: "BOS", slug: "boston-celtics" },
  { id: 4,  name: "Brooklyn Nets",          abbr: "BKN", slug: "brooklyn-nets" },
  { id: 5,  name: "Charlotte Hornets",      abbr: "CHA", slug: "charlotte-hornets" },
  { id: 6,  name: "Chicago Bulls",          abbr: "CHI", slug: "chicago-bulls" },
  { id: 7,  name: "Cleveland Cavaliers",    abbr: "CLE", slug: "cleveland-cavaliers" },
  { id: 8,  name: "Dallas Mavericks",       abbr: "DAL", slug: "dallas-mavericks" },
  { id: 9,  name: "Denver Nuggets",         abbr: "DEN", slug: "denver-nuggets" },
  { id: 10, name: "Detroit Pistons",        abbr: "DET", slug: "detroit-pistons" },
  { id: 11, name: "Golden State Warriors",  abbr: "GSW", slug: "golden-state-warriors" },
  { id: 14, name: "Houston Rockets",        abbr: "HOU", slug: "houston-rockets" },
  { id: 15, name: "Indiana Pacers",         abbr: "IND", slug: "indiana-pacers" },
  { id: 16, name: "LA Clippers",            abbr: "LAC", slug: "los-angeles-clippers" },
  { id: 17, name: "Los Angeles Lakers",     abbr: "LAL", slug: "los-angeles-lakers" },
  { id: 19, name: "Memphis Grizzlies",      abbr: "MEM", slug: "memphis-grizzlies" },
  { id: 20, name: "Miami Heat",             abbr: "MIA", slug: "miami-heat" },
  { id: 21, name: "Milwaukee Bucks",        abbr: "MIL", slug: "milwaukee-bucks" },
  { id: 22, name: "Minnesota Timberwolves", abbr: "MIN", slug: "minnesota-timberwolves" },
  { id: 23, name: "New Orleans Pelicans",   abbr: "NOP", slug: "new-orleans-pelicans" },
  { id: 24, name: "New York Knicks",        abbr: "NYK", slug: "new-york-knicks" },
  { id: 25, name: "Oklahoma City Thunder",  abbr: "OKC", slug: "oklahoma-city-thunder" },
  { id: 26, name: "Orlando Magic",          abbr: "ORL", slug: "orlando-magic" },
  { id: 27, name: "Philadelphia 76ers",     abbr: "PHI", slug: "philadelphia-76ers" },
  { id: 28, name: "Phoenix Suns",           abbr: "PHX", slug: "phoenix-suns" },
  { id: 29, name: "Portland Trail Blazers", abbr: "POR", slug: "portland-trailblazers" },
  { id: 30, name: "Sacramento Kings",       abbr: "SAC", slug: "sacramento-kings" },
  { id: 31, name: "San Antonio Spurs",      abbr: "SAS", slug: "san-antonio-spurs" },
  { id: 38, name: "Toronto Raptors",        abbr: "TOR", slug: "toronto-raptors" },
  { id: 40, name: "Utah Jazz",              abbr: "UTA", slug: "utah-jazz" },
  { id: 41, name: "Washington Wizards",     abbr: "WAS", slug: "washington-wizards" },
];

export const SLOT_LABELS = ["PG", "SG", "SF", "PF", "C", "6", "7", "8", "9", "10", "11", "12"];

export const getLogoUrl = (slug) => `/media/${slug}.svg`;
