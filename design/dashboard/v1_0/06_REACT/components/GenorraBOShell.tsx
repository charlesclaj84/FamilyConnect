import React from "react";
import "../styles/genorra-bo.css";

export function GenorraBOShell({children}:{children:React.ReactNode}){return <div className="g-shell"><aside className="g-sidebar"><img src="/genorra/vector/Sidebar.svg" alt="" aria-hidden="true" /></aside><main className="g-main">{children}</main></div>}
