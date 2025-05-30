import * as d3 from 'd3';
import data from './allTemplates.json' assert { type: 'json' };
    
(async function() {
    const width = 800;
    const height = 600;
    //this is a test comment
    const nodes = data.nodes;
    const links = data.links;

    const svg = d3.select("body").append("svg")
    .attr("viewBox", [0, 0, width, height])
    .call(d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
    }));

    const g = svg.append("g");

    const simulation = d3.forceSimulation(data.nodes)
    .force("link", d3.forceLink(data.links).id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(80).strength(0.5));

    const link = g.append("g")
    .attr("stroke", "#aaa")
    .selectAll("line")
    .data(data.links)
    .join("line");

    const node = g.selectAll(".node")
    .data(data.nodes)
    .join("g")
    .attr("class", "node")
    .call(drag(simulation))
    .on("click", (_, clicked) => {
        node.select("rect").attr("fill", d => {
        if (d.id === clicked.id) return "gray";
        const isParent = data.links.some(link => link.target === clicked.id && link.source === d.id);
        const isChild = data.links.some(link => link.source === clicked.id && link.target === d.id);
        if (isParent) return "purple";
        if (isChild) return "green";
        return "steelblue";
        });
    });

    node.append("rect")
    .attr("fill", "steelblue")
    .attr("stroke", "#333")
    .attr("rx", 5)
    .attr("height", 40)
    .attr("width", d => 10 + Math.max(d.name.length, d.type.length) * 7)
    .attr("y", -20)
    .attr("x", d => -((10 + Math.max(d.name.length, d.type.length) * 7) / 2));

    node.append("text")
    .attr("text-anchor", "middle")
    .attr("y", -5)
    .attr("fill", "white")
    .style("font-size", "12px")
    .text(d => d.name);

    node.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 12)
    .attr("fill", "white")
    .style("font-size", "10px")
    .text(d => d.type);

    simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
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
})();