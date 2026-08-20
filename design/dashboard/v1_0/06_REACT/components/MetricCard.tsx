import React from "react";
export type Metric={value:string;label:string;link:string;accent:"burgundy"|"gold"|"olive"|"orange";icon:string};
export function MetricCard({m}:{m:Metric}){return <article className={`g-metric g-accent-${m.accent}`}><span className="g-icon" aria-hidden="true">{m.icon}</span><strong>{m.value}</strong><span>{m.label}</span><a href="#">{m.link}</a></article>}
