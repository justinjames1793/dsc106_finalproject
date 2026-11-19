import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ---------- config ----------
const DEFAULT_COUNTRIES = [
  "United States", "China", "Germany", "Japan", "India",
  "United Kingdom", "France", "Italy", "Brazil", "South Korea",
];
const METRIC_LABELS = {
  renewables_share_elec: "Renewables share of electricity",
  low_carbon_share_elec: "Low-carbon share of electricity",
  fossil_share_elec: "Fossil fuel share of electricity",
  coal_share_elec: "Coal share of electricity",
};

const width = 860;
const height = 460;
const margin = { top: 20, right: 120, bottom: 40, left: 50 };

// ---------- state ----------
let selected = [...DEFAULT_COUNTRIES];
let metric = "renewables_share_elec";

// ---------- load data ----------
const data = await d3.csv("data/energy_trimmed.csv", (d) => ({
  country: d.country,
  iso: d.iso_code,
  year: +d.year,
  renewables_share_elec: d.renewables_share_elec === "" ? null : +d.renewables_share_elec,
  low_carbon_share_elec: d.low_carbon_share_elec === "" ? null : +d.low_carbon_share_elec,
  fossil_share_elec: d.fossil_share_elec === "" ? null : +d.fossil_share_elec,
  coal_share_elec: d.coal_share_elec === "" ? null : +d.coal_share_elec,
}));

const byCountry = d3.group(data, (d) => d.country);
const allCountries = [...byCountry.keys()].sort(d3.ascending);

// Stable color per country (a country keeps its color when others are added/removed).
// The 10 default countries get the 10 Tableau colors; added countries cycle through Set2.
const color = d3.scaleOrdinal()
  .domain(allCountries.filter((c) => !DEFAULT_COUNTRIES.includes(c)))
  .range(d3.schemeSet2);
const colorFor = (c) => {
  const i = DEFAULT_COUNTRIES.indexOf(c);
  return i >= 0 ? d3.schemeTableau10[i] : color(c);
};

// ---------- scaffolding ----------
const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", [0, 0, width, height]);

const x = d3.scaleLinear()
  .domain(d3.extent(data, (d) => d.year))
  .range([margin.left, width - margin.right]);

const y = d3.scaleLinear()
  .domain([0, 100])
  .range([height - margin.bottom, margin.top]);

svg.append("g")
  .attr("class", "grid")
  .attr("transform", `translate(${margin.left},0)`)
  .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(""));

svg.append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${height - margin.bottom})`)
  .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(8));

svg.append("g")
  .attr("class", "axis")
  .attr("transform", `translate(${margin.left},0)`)
  .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d + "%"));

const yLabel = svg.append("text")
  .attr("x", margin.left)
  .attr("y", margin.top - 6)
  .attr("font-size", 12)
  .attr("fill", "#5f6670");

const linesG = svg.append("g");
const labelsG = svg.append("g");
const hoverRule = svg.append("line")
  .attr("class", "hover-rule")
  .attr("y1", margin.top)
  .attr("y2", height - margin.bottom)
  .style("display", "none");

const line = d3.line()
  .defined((d) => d.value != null)
  .x((d) => x(d.year))
  .y((d) => y(d.value));

// ---------- render ----------
function seriesFor(country) {
  return (byCountry.get(country) || [])
    .map((d) => ({ year: d.year, value: d[metric] }))
    .sort((a, b) => a.year - b.year);
}

function render() {
  yLabel.text(METRIC_LABELS[metric] + " (%)");

  const series = selected.map((c) => ({ country: c, values: seriesFor(c) }));

  linesG.selectAll("path")
    .data(series, (d) => d.country)
    .join("path")
    .attr("class", "line")
    .attr("stroke", (d) => colorFor(d.country))
    .transition().duration(500)
    .attr("d", (d) => line(d.values));

  // End-of-line labels, nudged apart so they don't overlap
  const ends = series
    .map((s) => {
      const last = [...s.values].reverse().find((v) => v.value != null);
      return last ? { country: s.country, year: last.year, value: last.value, y: y(last.value) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);
  const minGap = 14;
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].y - ends[i - 1].y < minGap) ends[i].y = ends[i - 1].y + minGap;
  }
  // If labels got pushed below the chart, push them back up from the bottom
  const maxY = height - margin.bottom;
  if (ends.length && ends[ends.length - 1].y > maxY) {
    ends[ends.length - 1].y = maxY;
    for (let i = ends.length - 2; i >= 0; i--) {
      if (ends[i + 1].y - ends[i].y < minGap) ends[i].y = ends[i + 1].y - minGap;
    }
  }

  labelsG.selectAll("text")
    .data(ends, (d) => d.country)
    .join("text")
    .attr("class", "end-label")
    .attr("fill", (d) => colorFor(d.country))
    .attr("x", (d) => x(d.year) + 6)
    .attr("dy", "0.35em")
    .text((d) => d.country)
    .transition().duration(500)
    .attr("y", (d) => d.y);

  renderChips();
  renderCountrySelect();
}

function renderChips() {
  d3.select("#chips")
    .selectAll("button")
    .data(selected, (d) => d)
    .join((enter) => {
      const b = enter.append("button").attr("class", "chip").attr("type", "button");
      b.append("span").attr("class", "swatch");
      b.append("span").attr("class", "name");
      b.append("span").attr("class", "x").text("×");
      return b;
    })
    .attr("title", (d) => `Remove ${d}`)
    .on("click", (event, d) => {
      selected = selected.filter((c) => c !== d);
      render();
    })
    .call((b) => b.select(".swatch").style("background", (d) => colorFor(d)))
    .call((b) => b.select(".name").text((d) => d));
}

function renderCountrySelect() {
  const options = ["", ...allCountries.filter((c) => !selected.includes(c))];
  d3.select("#country-select")
    .selectAll("option")
    .data(options, (d) => d)
    .join("option")
    .attr("value", (d) => d)
    .text((d) => (d === "" ? "Choose a country…" : d));
  d3.select("#country-select").property("value", "");
}

// ---------- interactions ----------
d3.select("#metric-select").on("change", (event) => {
  metric = event.target.value;
  render();
});

d3.select("#country-select").on("change", (event) => {
  const c = event.target.value;
  if (c && !selected.includes(c)) {
    selected.push(c);
    render();
  }
});

d3.select("#reset-btn").on("click", () => {
  selected = [...DEFAULT_COUNTRIES];
  render();
});

// Hover: vertical rule + tooltip listing every selected country's value that year
const tooltip = d3.select("#tooltip");
svg.append("rect")
  .attr("x", margin.left)
  .attr("y", margin.top)
  .attr("width", width - margin.left - margin.right)
  .attr("height", height - margin.top - margin.bottom)
  .attr("fill", "transparent")
  .on("mousemove", (event) => {
    const [mx] = d3.pointer(event);
    const year = Math.round(x.invert(mx));
    hoverRule.attr("x1", x(year)).attr("x2", x(year)).style("display", null);

    const rows = selected
      .map((c) => {
        const v = (byCountry.get(c) || []).find((d) => d.year === year);
        return { country: c, value: v ? v[metric] : null };
      })
      .filter((r) => r.value != null)
      .sort((a, b) => b.value - a.value);

    tooltip
      .attr("hidden", null)
      .html(
        `<div class="yr">${year}</div>` +
        rows.map((r) =>
          `<div class="row" style="--c:${colorFor(r.country)}"><span>${r.country}</span><span>${r.value.toFixed(1)}%</span></div>`
        ).join("")
      );

    // Keep tooltip on screen
    const tw = tooltip.node().offsetWidth;
    const left = event.clientX + 16 + tw > window.innerWidth ? event.clientX - tw - 16 : event.clientX + 16;
    tooltip.style("left", left + "px").style("top", event.clientY + 12 + "px");
  })
  .on("mouseleave", () => {
    hoverRule.style("display", "none");
    tooltip.attr("hidden", true);
  });

render();
