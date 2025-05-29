import React, { createContext, useContext, useState, useEffect } from "react";
import { usePlayer } from "./PlayerContext";
import { useLineup } from "./LineupContext";

const ExposureContext = createContext();

export const useExposure = () => {
  const context = useContext(ExposureContext);
  if (!context) {
    throw new Error("useExposure must be used within ExposureProvider");
  }
  return context;
};

export const ExposureProvider = ({ children }) => {
  const { playerData } = usePlayer();
  const { lineups } = useLineup();

  const [exposureSettings, setExposureSettings] = useState({
    global: {
      globalMinExposure: 0,
      globalMaxExposure: 60,
      applyToNewLineups: true,
      prioritizeProjections: true,
    },
    players: [],
    teams: [],
    positions: {
      TOP: { min: 0, max: 100, target: null },
      JNG: { min: 0, max: 100, target: null },
      MID: { min: 0, max: 100, target: null },
      ADC: { min: 0, max: 100, target: null },
      SUP: { min: 0, max: 100, target: null },
      CPT: { min: 0, max: 100, target: null },
    },
    stackExposureTargets: {},
  });

  // Initialize exposure settings when player data is loaded
  useEffect(() => {
    if (playerData.length > 0 && exposureSettings.players.length === 0) {
      const initialPlayerExposures = playerData.map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        salary: player.salary,
        projectedPoints: player.projectedPoints,
        ownership: player.ownership,
        min: exposureSettings.global.globalMinExposure,
        max: exposureSettings.global.globalMaxExposure,
        target: null,
        actual: 0,
      }));

      const teams = [
        ...new Set(playerData.map((player) => player.team)),
      ].filter(Boolean);
      const initialTeamExposures = teams.map((team) => ({
        team,
        min: 0,
        max: 100,
        target: null,
        actual: 0,
      }));

      setExposureSettings((prev) => ({
        ...prev,
        players: initialPlayerExposures,
        teams: initialTeamExposures,
      }));
    }
  }, [playerData, exposureSettings.global, exposureSettings.players.length]);

  // Recalculate actual exposures when lineups change
  useEffect(() => {
    if (lineups.length > 0 && exposureSettings.players.length > 0) {
      const playerExposureMap = new Map();
      const teamExposureMap = new Map();
      const positionExposureMap = new Map();

      lineups.forEach((lineup) => {
        if (lineup.cpt) {
          const key = `${lineup.cpt.name}_${lineup.cpt.team}`;
          playerExposureMap.set(key, (playerExposureMap.get(key) || 0) + 1);
          teamExposureMap.set(
            lineup.cpt.team,
            (teamExposureMap.get(lineup.cpt.team) || 0) + 1
          );
          positionExposureMap.set(
            "CPT",
            (positionExposureMap.get("CPT") || 0) + 1
          );
        }

        if (lineup.players) {
          lineup.players.forEach((player) => {
            const key = `${player.name}_${player.team}`;
            playerExposureMap.set(key, (playerExposureMap.get(key) || 0) + 1);
            teamExposureMap.set(
              player.team,
              (teamExposureMap.get(player.team) || 0) + 1
            );
            positionExposureMap.set(
              player.position,
              (positionExposureMap.get(player.position) || 0) + 1
            );
          });
        }
      });

      setExposureSettings((prev) => ({
        ...prev,
        players: prev.players.map((player) => {
          const key = `${player.name}_${player.team}`;
          const count = playerExposureMap.get(key) || 0;
          const actual = (count / lineups.length) * 100;
          return { ...player, actual };
        }),
        teams: prev.teams.map((team) => {
          const count = teamExposureMap.get(team.team) || 0;
          const actual = (count / lineups.length) * 100;
          return { ...team, actual };
        }),
        positions: Object.fromEntries(
          Object.entries(prev.positions).map(([pos, settings]) => {
            const count = positionExposureMap.get(pos) || 0;
            const actual = (count / lineups.length) * 100;
            return [pos, { ...settings, actual }];
          })
        ),
      }));
    }
  }, [lineups]);

  const value = {
    exposureSettings,
    setExposureSettings,
  };

  return (
    <ExposureContext.Provider value={value}>
      {children}
    </ExposureContext.Provider>
  );
};
