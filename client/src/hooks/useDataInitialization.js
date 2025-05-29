import { useEffect } from "react";
import { useApp } from "../contexts/AppContext";
import { usePlayer } from "../contexts/PlayerContext";
import { useLineup } from "../contexts/LineupContext";
import { useNotification } from "../contexts/NotificationContext";
import { playerService, teamService, lineupService } from "../services";

export const useDataInitialization = () => {
  const { setIsLoading } = useApp();
  const { playerData, setPlayerData, setStackData } = usePlayer();
  const { setLineups } = useLineup();
  const { displayNotification } = useNotification();

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);

      try {
        const [playersRes, stacksRes, lineupsRes] = await Promise.all([
          playerService.getProjections().catch((err) => {
            console.error("Error fetching player projections:", err);
            return null;
          }),
          teamService.getTeamStacks().catch((err) => {
            console.error("Error fetching team stacks:", err);
            return null;
          }),
          lineupService.getLineups().catch((err) => {
            console.error("Error fetching lineups:", err);
            return null;
          }),
        ]);

        if (playersRes) {
          const processedPlayers = playersRes.map((player) => ({
            ...player,
            projectedPoints:
              player.projectedPoints !== undefined
                ? Number(player.projectedPoints)
                : 0,
            ownership:
              player.ownership !== undefined
                ? Number(player.ownership)
                : undefined,
          }));
          setPlayerData(processedPlayers);
        } else {
          console.error("Failed to load player projections");
        }

        if (stacksRes) {
          const enhancedStacks = stacksRes.map((stack) => {
            const teamPlayers = playerData.filter((p) => p.team === stack.team);
            const totalProjection = teamPlayers.reduce(
              (sum, p) => sum + (p.projectedPoints || 0),
              0
            );

            return {
              ...stack,
              totalProjection,
              poolExposure:
                teamPlayers.reduce((sum, p) => sum + (p.ownership || 0), 0) /
                Math.max(1, teamPlayers.length),
              status: "—",
            };
          });
          setStackData(enhancedStacks);
        } else {
          console.error("Failed to load team stacks");
        }

        if (lineupsRes) {
          const enhancedLineups = lineupsRes.map((lineup) => {
            const allPlayers = lineup.cpt
              ? [lineup.cpt, ...(lineup.players || [])]
              : lineup.players || [];
            const teamCounts = {};

            allPlayers.forEach((player) => {
              if (player && player.team) {
                teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
              }
            });

            let totalProj = 0;
            if (lineup.cpt) {
              const cptPlayer = playerData.find((p) => p.id === lineup.cpt.id);
              const cptProj = cptPlayer?.projectedPoints || 0;
              totalProj += cptProj * 1.5;
            }

            totalProj += (lineup.players || [])
              .map((p) => {
                const fullPlayer = playerData.find((fp) => fp.id === p.id);
                return fullPlayer?.projectedPoints || p.projectedPoints || 0;
              })
              .reduce((sum, proj) => sum + proj, 0);

            const totalOwnership = allPlayers.reduce((sum, p) => {
              const fullPlayer = playerData.find((fp) => fp.id === p.id);
              return sum + (fullPlayer?.ownership || p.ownership || 0);
            }, 0);

            const avgOwn =
              allPlayers.length > 0 ? totalOwnership / allPlayers.length : 0;

            let stackBonus = 0;
            Object.values(teamCounts).forEach((count) => {
              if (count >= 3) stackBonus += (count - 2) * 3;
            });

            const ownership = Math.max(0.1, avgOwn / 100);
            const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership));
            const baseScore = totalProj / 10;
            const nexusScore = Math.min(
              65,
              Math.max(25, baseScore * leverageFactor + stackBonus / 2)
            );

            return {
              ...lineup,
              totalProjection: Number(totalProj.toFixed(2)),
              avgOwnership: Number(avgOwn.toFixed(2)),
              nexusScore: Number(nexusScore.toFixed(1)),
              teamCounts,
            };
          });
          setLineups(enhancedLineups);
        } else {
          console.error("Failed to load lineups");
        }
      } catch (error) {
        console.error("Error during data initialization:", error);
        displayNotification("Error loading initial data", "error");
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  return { playerData };
};
