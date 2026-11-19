import { ToolDefinition } from './types';

export interface SearchResult {
  tool: ToolDefinition;
  score: number;
}

export function scoreTool(tool: ToolDefinition, query: string): number {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return 1;

  const queryTerms = cleanQuery.split(/\s+/).filter(Boolean);
  const name = tool.name.toLowerCase();
  const description = tool.description.toLowerCase();
  const id = tool.id.toLowerCase();
  const keywords = tool.keywords.map((k) => k.toLowerCase());

  let totalScore = 0;

  // Exact ID or Name match
  if (id === cleanQuery) totalScore += 100;
  if (name === cleanQuery) totalScore += 90;

  // Prefix match
  if (name.startsWith(cleanQuery)) totalScore += 60;
  if (id.startsWith(cleanQuery)) totalScore += 50;

  // Substring match in name
  if (name.includes(cleanQuery)) totalScore += 40;

  for (const term of queryTerms) {
    let termMatched = false;

    // Term in name
    if (name.includes(term)) {
      totalScore += 25;
      termMatched = true;
    }

    // Term in id
    if (id.includes(term)) {
      totalScore += 20;
      termMatched = true;
    }

    // Exact keyword match
    if (keywords.includes(term)) {
      totalScore += 30;
      termMatched = true;
    } else {
      // Partial keyword match
      const matchingKeyword = keywords.find((k) => k.includes(term));
      if (matchingKeyword) {
        totalScore += 15;
        termMatched = true;
      }
    }

    // Description match
    if (description.includes(term)) {
      totalScore += 10;
      termMatched = true;
    }

    // If query term didn't match anywhere, penalize or return 0
    if (!termMatched) {
      return 0;
    }
  }

  // Slight boost for popular tools to break ties nicely
  if (tool.popular) {
    totalScore += 2;
  }

  return totalScore;
}

export function searchTools(
  tools: ToolDefinition[],
  query: string,
  category = 'all'
): ToolDefinition[] {
  const filteredByCategory =
    category === 'all'
      ? tools
      : tools.filter((tool) => tool.category === category);

  const trimmed = query.trim();
  if (!trimmed) {
    return filteredByCategory;
  }

  const scored: SearchResult[] = [];

  for (const tool of filteredByCategory) {
    const score = scoreTool(tool, trimmed);
    if (score > 0) {
      scored.push({ tool, score });
    }
  }

  // Sort descending by score, then alphabetically by name
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.tool.name.localeCompare(b.tool.name);
  });

  return scored.map((item) => item.tool);
}
