/**
 * MaritimeMap.tsx
 * Reusable, typed Maritime Investigation Map component.
 * Wrapper/re-export for the enhanced OCEANTRACE AI InvestigationMap architecture.
 */

import React from "react";
import { InvestigationMap } from "./map/InvestigationMap";

export interface MaritimeMapProps {
  onRegisterFlyTo?: (
    fn: (lon: number, lat: number, zoom: number) => void,
  ) => void;
  onRegisterResetView?: (fn: () => void) => void;
}

export const MaritimeMap: React.FC<MaritimeMapProps> = (props) => {
  return <InvestigationMap {...props} />;
};

export default MaritimeMap;
export { InvestigationMap };
