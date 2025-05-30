import * as d3 from 'd3';
import data from './allTemplates.json' assert { type: 'json' };

// Editable diagram params
let screenWidth = 1600;
let screenHeight = 800;
const diagramType = Object.freeze({
  FORCESIM: "force",
  FLOWCHART: "flow",
  CIRCLE: "circle"
});
let selectedType = diagramType.FORCESIM;
let forceLinkDistance = 100;
let forceNodeAttraction = -200; //negative is repelling - positive is attracting
let minZoom = 0.1;
let maxZoom = 10;


const radioGroup = document.getElementById("radioGroup");

Object.entries(diagramType).forEach(([key, value], index) => {
  const id = `diagram-${value}`;

  // Create radio input
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "diagram";
  input.value = value;
  input.id = id;
  if (selectedType === diagramType.value){
    input.checked = true;
  }
  if (index === 0) input.checked = true;

  // Create label
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = key.charAt(0) + key.slice(1).toLowerCase(); // Optional: Pretty label

  // Append to DOM
  radioGroup.appendChild(input);
  radioGroup.appendChild(label);
  radioGroup.appendChild(document.createElement("br"));
});

// Listen for changes
radioGroup.addEventListener("change", (e) => {
  if (e.target.name === "diagram" && e.target.checked) {
    selectedType = e.target.value;
    console.log("Selected type:", selectedType);
  }
});


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

/**
 * 
 * @param {string} containerId
 * @param {[]} nodesToDisplay
 * @param {[]} parentsMap
 * @param {[]} childrenMap
 * @param {number} width
 * @param {number} height 
 * @param {diagramType} diagramTypeOverride
 */
function svgSetup(containerId, nodesToDisplay, parentsMap, childrenMap, width, height, diagramTypeOverride = null) {
  const svg = d3.select("#" + containerId)
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .style('display', 'block');

  const container = svg.append('g');
  
  if (diagramTypeOverride !== null && Object.values(diagramType).includes(diagramTypeOverride)) {selectedType = diagramTypeOverride}
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
    .on('click', function (event, d) {
      // Reset all
      nodeGroups.select('rect').attr('fill', 'steelblue');
      nodeGroups.selectAll('text').attr('fill', 'white');

      svgSetup("overlay", [d], parentsMap, childrenMap, diagramType.FLOWCHART);

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
      .attr('x1', d => nodeMap.get(d.source).x)
      .attr('y1', d => nodeMap.get(d.source).y + 25)
      .attr('x2', d => nodeMap.get(d.target).x)
      .attr('y2', d => nodeMap.get(d.target).y - 25)
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
    .on('click', function (event, d) {
      // Reset all
      nodeGroups.select('rect').attr('fill', 'steelblue');
      nodeGroups.selectAll('text').attr('fill', 'white');

      svgSetup("overlay", [d], parentsMap, childrenMap, diagramType.FLOWCHART);

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

let svg = svgSetup("container", nodes, parentsMap, childrenMap, screenWidth, screenHeight);

const widthInput = document.getElementById("width");
const heightInput = document.getElementById("height");

widthInput.addEventListener("input", (event) => {
  screenWidth = event.target.value;
});

heightInput.addEventListener("input", (event) => {
  screenHeight = event.target.value;
});

document.querySelectorAll('input[name="diagram-type"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    console.log("Radio changed");
    if (radio.checked) {
      selectedType = radio.value;
      console.log("Selected type:", selectedType);
    }
  });
});

window.toggleMenu = function() {
  const overlay = document.getElementById("search-overlay");
  overlay.classList.toggle("hidden");
}

window.refreshSvg = function() {
  d3.selectAll('svg').remove();
  svg = svgSetup("container", nodes, parentsMap, childrenMap, screenWidth, screenHeight);
}

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
    d3.zoomIdentity.translate(screenWidth / 2 - zoomLevel * x, screenHeight / 2 - zoomLevel * y).scale(zoomLevel)
  );
};