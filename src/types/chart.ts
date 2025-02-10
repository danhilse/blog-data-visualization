export interface DataNode {
  name: string;
  value?: number;
  children?: DataNode[];
}

export interface UseCaseMapping {
  [key: string]: {
    getKeepGrow: string;
    cmoPriority: string;
  };
}

export const useCaseMapping: UseCaseMapping = {
  "Convert unknown visitors to know leads": {
    getKeepGrow: "1-GET",
    cmoPriority: "New customer acquisition"
  },
  "Identify and target audience segments": {
    getKeepGrow: "1-GET",
    cmoPriority: "New customer acquisition"
  },
  "Reach new prospects through omni-channel campaigns": {
    getKeepGrow: "1-GET",
    cmoPriority: "New customer acquisition"
  },
  "Personalize outreach and communication": {
    getKeepGrow: "1-GET",
    cmoPriority: "Build Pipeline and Accelerate Sales"
  },
  "Nurture prospects into opportunities": {
    getKeepGrow: "1-GET",
    cmoPriority: "Build Pipeline and Accelerate Sales"
  },
  "Deliver the best leads to sales": {
    getKeepGrow: "1-GET",
    cmoPriority: "Build Pipeline and Accelerate Sales"
  },
  "Empower Sales with account intelligence": {
    getKeepGrow: "1-GET",
    cmoPriority: "Build Pipeline and Accelerate Sales"
  },
  "Scale demand generation operations": {
    getKeepGrow: "1-GET",
    cmoPriority: "Build Pipeline and Accelerate Sales"
  },
  "Welcome and onboard new customers": {
    getKeepGrow: "2-KEEP",
    cmoPriority: "Deliver value and retain customers"
  },
  "Drive product adoption & usage": {
    getKeepGrow: "2-KEEP",
    cmoPriority: "Deliver value and retain customers"
  },
  "Engage customers with regular communication": {
    getKeepGrow: "2-KEEP",
    cmoPriority: "Deliver value and retain customers"
  },
  "Automate customer renewal": {
    getKeepGrow: "2-KEEP",
    cmoPriority: "Deliver value and retain customers"
  },
  "Grow advocates; build loyalty": {
    getKeepGrow: "3-GROW",
    cmoPriority: "Increase customer loyalty"
  },
  "Automate internal & partner communications": {
    getKeepGrow: "3-GROW",
    cmoPriority: "Increase customer loyalty"
  },
  "Cross-sell and upsell": {
    getKeepGrow: "3-GROW",
    cmoPriority: "Maximize Customer Revenue (ARPU)"
  },
  "Improve marketing performance": {
    getKeepGrow: "4-OPTIMIZE",
    cmoPriority: "Maximizing MROI"
  },
  "Be a data-driven marketing org": {
    getKeepGrow: "4-OPTIMIZE",
    cmoPriority: "Maximizing MROI"
  },
  "Scale marketing output": {
    getKeepGrow: "4-OPTIMIZE",
    cmoPriority: "Maximizing MROI"
  },
  "Create a single source of truth for Marketing": {
    getKeepGrow: "4-OPTIMIZE",
    cmoPriority: "Maximizing MROI"
  }
};

// Helper function to build hierarchy from use case mapping
export function buildHierarchy(): DataNode {
  const root: DataNode = {
    name: "Marketing Use Cases",
    children: []
  };

  // First create a map of getKeepGrow -> CMO Priority -> Use Cases
  const hierarchy: Record<string, Record<string, string[]>> = {};

  Object.entries(useCaseMapping).forEach(([useCase, mapping]) => {
    const { getKeepGrow, cmoPriority } = mapping;
    
    // Initialize getKeepGrow level if needed
    if (!hierarchy[getKeepGrow]) {
      hierarchy[getKeepGrow] = {};
    }
    
    // Initialize CMO Priority level if needed
    if (!hierarchy[getKeepGrow][cmoPriority]) {
      hierarchy[getKeepGrow][cmoPriority] = [];
    }
    
    // Add use case
    hierarchy[getKeepGrow][cmoPriority].push(useCase);
  });

  // Convert the hierarchy map to our DataNode structure
  root.children = Object.entries(hierarchy)
    .sort(([a], [b]) => a.localeCompare(b)) // Sort GET/KEEP/GROW/OPTIMIZE
    .map(([getKeepGrow, cmoPriorities]) => ({
      name: getKeepGrow,
      children: Object.entries(cmoPriorities)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort CMO Priorities
        .map(([priority, useCases]) => ({
          name: priority,
          children: useCases
            .sort((a, b) => a.localeCompare(b)) // Sort Use Cases
            .map(useCase => ({
              name: useCase,
              value: 1
            }))
        }))
    }));

  console.log('Built hierarchy:', JSON.stringify(root, null, 2));
  return root;
}

export const marketingUseCases = buildHierarchy();