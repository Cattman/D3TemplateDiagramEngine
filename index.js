import * as d3 from 'd3';
import data from './allTemplates.json' assert { type: 'json' };

const screenWidth = 1600;
const height = 800;

const nodes = data.nodes.sort();
const links = data.links;

const sortedNames = nodes
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

// Build maps for fast lookup
const nodeMap = new Map(nodes.map(d => [d.id, d]));
const childrenMap = new Map();
const parentsMap = new Map();

links.forEach(link => {
  if (!childrenMap.has(link.source)) childrenMap.set(link.source, []);
  if (!parentsMap.has(link.target)) parentsMap.set(link.target, []);
  childrenMap.get(link.source).push(link.target);
  parentsMap.get(link.target).push(link.source);
});

function openOverlay(node){
  // Clear previous content
  // create svg
  // 
  // Make the Overlay visible
  const overlay = document.getElementById("overlay");
  overlay.style.display = "block";
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
const centerX = width / 2;
const centerY = height / 2;
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

/**
 * 
 * @param {string} containerId
 * @param {[]} nodes
 * @param {[]} parentsMap
 * @param {[]} childrenMap
 * @param {number} width
 * @param {number} height 
 */
function svgSetup(containerId, nodes, parentsMap, childrenMap, width = 1600, height = 800) {
  const svg = d3.select("#" + containerId)
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .style('display', 'block');

  const container = svg.append('g');

  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => container.attr('transform', event.transform));

  svg.call(zoom);

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
    .attr('x1', d => nodeMap.get(d.source).x)
    .attr('y1', d => nodeMap.get(d.source).y + 25)
    .attr('x2', d => nodeMap.get(d.target).x)
    .attr('y2', d => nodeMap.get(d.target).y - 25)
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr('marker-end', 'url(#arrow)');

  // === Draw Nodes ===
  const nodeGroups = container.selectAll('g.node')
  .data(nodes)
  .join('g')
  .attr('class', 'node')
  .attr('transform', d => `translate(${d.x}, ${d.y})`)
  .style('cursor', 'pointer')
  .on('click', function (event, d) {
    // Reset all
    nodeGroups.select('rect').attr('fill', 'steelblue');
    nodeGroups.selectAll('text').attr('fill', 'white');

    svgSetup("overlay", d, parentsMap, childrenMap);

    // Highlight clicked node
    d3.select(this).select('rect').attr('fill', 'orange');
    d3.select(this).selectAll('text').attr('fill', 'white');

    const parentIds = parentsMap.get(d.id) || [];
    parentIds.forEach(pid => {
      container.selectAll('g.node')
        .filter(nd => nd.id === pid)
        .select('rect')
        .attr('fill', 'purple');
    });

    const childIds = childrenMap.get(d.id) || [];
    childIds.forEach(cid => {
      container.selectAll('g.node')
        .filter(nd => nd.id === cid)
        .select('rect')
        .attr('fill', 'green');
    });
  });
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

  return svg;
}


/**
nodeGroups.attr('transform', d => {
  const dx = d.x - centerX;
  const dy = d.y - centerY;
  const angle = Math.atan2(dy, dx) * 0 / Math.PI;
  return `translate(${d.x}, ${d.y}) rotate(${angle})`;
});
*/
const svg = svgSetup("container", nodes, parentsMap, childrenMap);

window.searchNode = function () {
  const term = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!term) return;

  const match = nodes.find(d => d.name.toLowerCase() === term);
  if (!match) {
    alert("Node not found.");
    return;
  }

  // Highlight the match
  nodeGroups.select('rect').attr('fill', d => d === match ? 'orange' : 'steelblue');
  nodeGroups.selectAll('text').attr('fill', 'white');

  // highlight parents and children
  const parentIds = parentsMap.get(match.id) || [];
    parentIds.forEach(pid => {
      container.selectAll('g.node')
        .filter(nd => nd.id === pid)
        .select('rect')
        .attr('fill', 'purple');
    });

    const childIds = childrenMap.get(match.id) || [];
    childIds.forEach(cid => {
      container.selectAll('g.node')
        .filter(nd => nd.id === cid)
        .select('rect')
        .attr('fill', 'green');
    });

  // Zoom and center on match
  const zoomLevel = 1.5;
  const x = match.x;
  const y = match.y;

  svg.transition().duration(750).call(
    zoom.transform,
    d3.zoomIdentity.translate(width / 2 - zoomLevel * x, height / 2 - zoomLevel * y).scale(zoomLevel)
  );
};