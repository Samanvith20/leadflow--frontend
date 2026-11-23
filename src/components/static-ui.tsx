import type { ReactNode } from "react";
export const status=(s:string)=><span className={`status-pill ${s==='Hot'?'status-hot':s==='Warm'?'status-warm':s==='Needs review'?'status-review':'status-new'}`}>{s}</span>;
export function Panel({title,children}:{title:string;children:ReactNode}){return <section className="panel section-panel"><div className="panel-heading"><div><h2>{title}</h2></div></div>{children}</section>}
