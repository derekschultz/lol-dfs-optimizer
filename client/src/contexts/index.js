import React from "react";
import { AppProvider } from "./AppContext";
import { PlayerProvider } from "./PlayerContext";
import { LineupProvider } from "./LineupContext";
import { ExposureProvider } from "./ExposureContext";
import { NotificationProvider } from "./NotificationContext";

export const CombinedProvider = ({ children }) => {
  return (
    <AppProvider>
      <NotificationProvider>
        <PlayerProvider>
          <LineupProvider>
            <ExposureProvider>{children}</ExposureProvider>
          </LineupProvider>
        </PlayerProvider>
      </NotificationProvider>
    </AppProvider>
  );
};

export * from "./AppContext";
export * from "./PlayerContext";
export * from "./LineupContext";
export * from "./ExposureContext";
export * from "./NotificationContext";
