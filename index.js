import * as d3 from 'd3';
import { generateDiagram, diagramType } from './diagram.mjs';
import data from './allTemplates.json' assert { type: 'json' };

// Editable diagram params
let screenWidth = 1600;
let screenHeight = 800;
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

let svg = generateDiagram("container", nodes, parentsMap, childrenMap, screenWidth, screenHeight, selectedType);

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
  svg = generateDiagram("container", nodes, parentsMap, childrenMap, screenWidth, screenHeight);
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
        .classList.toggle("parent");
    });

    const childIds = childrenMap.get(match.id) || [];
    childIds.forEach(cid => {
      container.selectAll('g.node')
        .filter(nd => nd.id === cid)
        .select('rect')
        .classList.toggle("child");
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