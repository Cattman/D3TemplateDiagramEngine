import * as d3 from 'd3';
import data from './allTemplates.json' assert { type: 'json' };

export const diagramType = Object.freeze({
  FORCESIM: "force",
  FLOWCHART: "flow",
  CIRCLE: "circle"
});

let nodes = [];
let links = [];
let nodeMap = new Map();
let childrenMap = new Map();
let parentsMap = new Map();

let screenWidth;
let screenHeight;
let selectedType = diagramType.FORCESIM;

let forceLinkDistance = 100;
let forceNodeAttraction = -200; //negative is repelling - positive is attracting
let minZoom = 0.1;
let maxZoom = 10;

/**
 * 
 * @param {Array} nodeArray 
 * @param {Array} linkArray 
 */
export function setDiagramData(nodeArray, linkArray) {
  nodes = nodeArray.sort();
  links = linkArray;
}

function sortNodeNames(nodeArray) {
  const sortedNames = nodeArray
    .map(d => d.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  // Populate autocomplete dropdown
  const datalist = document.getElementById("nodeNames");
  sortedNames.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
  });
  return sortedNames;
}

// Build maps for fast lookup
/**
 * 
 * @param {*} nodesArray 
 * @param {*} linksArray  
 */
function buildNodeMaps(nodesArray, linksArray) {
  nodeMap = new Map(nodesArray.map(d => [d.id, d]));
  linksArray.forEach(link => {
    if (!childrenMap.has(link.source)) childrenMap.set(link.source, []);
    if (!parentsMap.has(link.target)) parentsMap.set(link.target, []);
    childrenMap.get(link.source).push(link.target);
    parentsMap.get(link.target).push(link.source);
  });
}

// Assign levels
function assignLevels(nodes, parentsMap) {
  /**
   * A Map to store levels.
   * @type {Map<NodeId, LevelNumber>}
   */
  const levels = new Map();
  const visited = new Set();

  function visit(id, level = 0) {
    if (levels.has(id)) {
      levels.set(id, Math.max(levels.get(id), level));
    } else {
      levels.set(id, level);
    }
    visited.add(id);

    const children = childrenMap.get(id) || [];
    for (const childId of children) {
      if (!visited.has(childId) || level + 1 > (levels.get(childId) ?? 0)) {
        visit(childId, level + 1);
      }
    }
  }

  const roots = nodes.filter(n => !parentsMap.has(n.id)).map(n => n.id);
  roots.forEach(rootId => visit(rootId));

  return levels;
}
/**
 * 
 * @param {*} nodes 
 * @param {*} parentsMap 
 * @returns 
 */
function assignPositions(nodes, parentsMap) {
  const levels = assignLevels(nodes, parentsMap);

  // Organize nodes by level
  /**
   * @type {Map<LevelNumber, Node[]>}
   */
  const levelNodes = new Map();
  levels.forEach((level, id) => {
    if (!levelNodes.has(level)) levelNodes.set(level, []);
    levelNodes.get(level).push(nodeMap.get(id));
  });

  // Assign positions
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  const radiusStep = 3200; // Distance between each ring

  levelNodes.forEach((nodesAtLevel, level) => {
    const radius = Math.log(level + 2) * radiusStep;
    const angleStep = (2 * Math.PI) / nodesAtLevel.length;

    nodesAtLevel.forEach((node, i) => {
      const angle = i * angleStep;
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
    });
  });
  return levelNodes;
}

let levelNodes = assignLevels(nodes, parentsMap)

export function nodeClick(node, nodeGroups) {
  // Reset all
      nodeGroups.select('rect').attr('fill', 'steelblue').classList.remove("highlight").remove("parent").remove("child");
      nodeGroups.selectAll('text').attr('fill', 'white');

      generateDiagram("overlay", [node], parentsMap, childrenMap, 400, 400, diagramType.FLOWCHART);

      // Highlight clicked node
      d3.select(this).select('rect').classList.add('highlight');
      d3.select(this).selectAll('text').attr('fill', 'white');

      const parentIds = parentsMap.get(node.id) || [];
      parentIds.forEach(pid => {
        container.selectAll('g.node')
          .filter(nd => nd.id === pid)
          .select('rect').classList.add('parent');
      });

      const childIds = childrenMap.get(node.id) || [];
      childIds.forEach(cid => {
        container.selectAll('g.node')
          .filter(nd => nd.id === cid)
          .select('rect').classList.add('child');
      });
}

export function setDiagramSettings(width, height, type, forceLinkDistance, forceNodeAttraction) {

} 

/**
 * 
 * @param {string} containerId
 * @param {[]} nodesToDisplay
 * @param {[]} parentsMap
 * @param {[]} childrenMap
 * @param {number} width
 * @param {number} height 
 * @param {diagramType} type
 */
export function generateDiagram (containerId, nodesToDisplay) {
  const svg = d3.select("#" + containerId)
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .style('display', 'block');

  const container = svg.append('g');
  let selectedType = diagramType.FORCESIM;
  
  if (type !== null && Object.values(diagramType).includes(type)) {selectedType = type}
  if (selectedType === diagramType.FORCESIM) {
    const simulation = d3.forceSimulation(nodesToDisplay)
      .force("link", d3.forceLink(links).id(d => d.id).distance(forceLinkDistance))
      .force("charge", d3.forceManyBody().strength(forceNodeAttraction))
      .force("center", d3.forceCenter(400, 300)); // svg center

    const link = container.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 2);

    const node = container.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodesToDisplay)
      .join("circle")
      .attr("r", 10)
      .call(drag(simulation));

    simulation.on("tick", () => {
      link        
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    });

    function drag(simulation) {
      return d3.drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
    }
  } else if (selectedType === diagramType.FLOWCHART) {  

    // Arrow marker
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');   
      
    // === Draw Links ===
    container.selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', d => nodeMap.get(d.source.id).x)
      .attr('y1', d => nodeMap.get(d.source.id).y + 25)
      .attr('x2', d => nodeMap.get(d.target.id).x)
      .attr('y2', d => nodeMap.get(d.target.id).y - 25)
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)');

    // === Draw Nodes ===
    const nodeGroups = container.selectAll('g.node')
    .data(nodesToDisplay)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x}, ${d.y})`)
    .style('cursor', 'pointer')
    .on('click', d => nodeClick(d, this));

    nodeGroups.append('rect')
    .attr('x', d => -((10 + Math.max(d.name.length, d.type.length) * 7) / 2))
    .attr('y', -25)
    .attr('width', d => 10 + Math.max(d.name.length, d.type.length) * 7)
    .attr('height', 50)
    .attr('rx', 8)
    .attr('fill', 'steelblue')
    .attr('stroke', '#333');

    nodeGroups.append('text')
      .attr("text-anchor", "middle")
      .attr("y", -5)
      .attr("fill", "white")
      .style("font-size", "12px")
      .text(d => d.name);

    nodeGroups.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 12)
      .attr("fill", "white")
      .style("font-size", "10px")
      .text(d => d.type);
  } else if (selectedType === diagramType.CIRCLE) {
      
    // Arrow marker
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');   
      
    // === Draw Links ===
    container.selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', d => nodeMap.get(d.source.id).x)
      .attr('y1', d => nodeMap.get(d.source.id).y + 25)
      .attr('x2', d => nodeMap.get(d.target.id).x)
      .attr('y2', d => nodeMap.get(d.target.id).y - 25)
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)');

    // === Draw Nodes ===
    const nodeGroups = container.selectAll('g.node')
    .data(nodesToDisplay)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x}, ${d.y})`)
    .style('cursor', 'pointer')
    .on('click', nodeClick(d, this));

    nodeGroups.append('rect')
    .attr('x', d => -((10 + Math.max(d.name.length, d.type.length) * 7) / 2))
    .attr('y', -25)
    .attr('width', d => 10 + Math.max(d.name.length, d.type.length) * 7)
    .attr('height', 50)
    .attr('rx', 8)
    .attr('fill', 'steelblue')
    .attr('stroke', '#333');

    nodeGroups.append('text')
      .attr("text-anchor", "middle")
      .attr("y", -5)
      .attr("fill", "white")
      .style("font-size", "12px")
      .text(d => d.name);

    nodeGroups.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 12)
      .attr("fill", "white")
      .style("font-size", "10px")
      .text(d => d.type);

    nodeGroups.attr('transform', d => {
      const dx = d.x - centerX;
      const dy = d.y - centerY;
      const angle = Math.atan2(dy, dx) * 0 / Math.PI;
      return `translate(${d.x}, ${d.y}) rotate(${angle})`;
    });
  } else {
    console.error("Diagram type is not a supported type: ", selectedType);    
  } 
  const zoom = d3.zoom()
    .scaleExtent([minZoom, maxZoom])
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
      console.log("ZOOM");
    });

  svg.call(zoom);
  
  return svg;
}

function appendArrow(svg) {
  // Arrow marker
  svg.append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#999');   
}

function drawLinks(container, links) {
  // === Draw Links ===
    container.selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', d => nodeMap.get(d.source.id).x)
      .attr('y1', d => nodeMap.get(d.source.id).y + 25)
      .attr('x2', d => nodeMap.get(d.target.id).x)
      .attr('y2', d => nodeMap.get(d.target.id).y - 25)
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)');
}