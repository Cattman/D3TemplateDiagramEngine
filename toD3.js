const fs = require('fs-extra');

// -------------  Per‑type strategy table  --------------------------
const TYPES = {
    template: {
      stereo: 'template',
      inner : () => '',              // extra box lines
      edge  : () => '--|>'           // arrow parent←child
    },
    section: {
      stereo: 'section',
      inner : () => '',
      edge  : () => '<|--'
    },
    branch: {
      stereo: 'branch',
      inner : node => '      + condition : bool\n',
      edge  : () => 'o--'
    },
    field: {
      stereo: 'field',
      inner : node => '      + value : string\n',
      edge  : () => '--'
    }
  };

/**
 * Convert flat nodes into Mermaid class‑diagram syntax.
 * @param {Array<{id:number, rootId:number|null, name:string, type:string}>} nodes
 * @returns {string} Mermaid code
 */
function toD3(nodes) {
  // 1 Header
  let out = 'classDiagram\n';
  let items = [];
  let links = [];

  // 2 Create class boxes (label = name, stereotype = type)
  for (const n of nodes) {
    const label = sanitize(n.name);
    const stereo = sanitize(n.type);
    out += `    class ${id(label, n.id)} {\n      <<${stereo}>>\n    }\n`;
  }

  // 3 Add relationships (arrow points child ➜ parent)
  for (const n of nodes) {
    const child = stamp(n);                      // box id of current node
    const strat = TYPES[n.type] ?? TYPES.section;
  
    // Helper to add one arrow line
    const addEdge = parentId => {
      const parentNode = idMap.get(parentId);
      if (!parentNode) return;                   // parent might be missing
      const parent = stamp(parentNode);
      out += `    ${parent} ${strat.edge(n)} ${child}\n`;
    };
  
    switch (n.type) {
      case 'branch':
        if (n.rootId != null) addEdge(n.rootId);
        break;
  
      case 'field':
        if (n.section != null) addEdge(n.section);
        break;
  
      case 'section':
        (n.bases || []).forEach(addEdge);
        break;
  
      default:
        if (n.rootId != null) addEdge(n.rootId); // sensible fallback
    }
  }
  return out;
}

// Helpers -----------------------------------------------------------
const sanitize = txt => txt.replace(/\s+/g, '_').replace(/[^\w]/g, '');
const id        = (name, id) => `${name}_${id}`;

// ------------------------------ CLI --------------------------------
async function run() {
  //const json = allTemplates.getTemplateData();
  await fs.readJson('templates.json');      // load your file
  const graph = toD3(json);
  await fs.writeFile('diagram.json', graph);
  console.log('Wrote diagram.mmd\n\n' + graph);
}
if (require.main === module) run();