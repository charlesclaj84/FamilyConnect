import React from "react";
import {GenorraBOShell} from "../components/GenorraBOShell";
import {WelcomeEventHero} from "../components/WelcomeEventHero";
import {FamilyTreeHighlights} from "../components/FamilyTreeHighlights";
export default function Dashboard(){return <GenorraBOShell><WelcomeEventHero/><div className="g-dashboard-lower">{/* AtAGlance, RecentActivity, FamilyTreeHighlights, QuickActions, UpcomingEvents */}<FamilyTreeHighlights/></div></GenorraBOShell>}
