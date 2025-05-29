import { useApp } from "../contexts/AppContext";
import { useLineup } from "../contexts/LineupContext";
import { usePlayer } from "../contexts/PlayerContext";
import { useExposure } from "../contexts/ExposureContext";
import { useNotification } from "../contexts/NotificationContext";

export const useLineupGeneration = () => {
  const { setIsLoading, setActiveTab } = useApp();
  const { setLineups } = useLineup();
  const { playerData } = usePlayer();
  const { exposureSettings } = useExposure();
  const { displayNotification } = useNotification();

  const generateOptimizedLineups = async (count, options = {}) => {
    try {
      setIsLoading(true);

      // Validate we have necessary data
      if (playerData.length === 0) {
        displayNotification(
          "No player projections loaded. Please upload player data first.",
          "error"
        );
        setIsLoading(false);
        return;
      }

      // Create the lineup generation request with options (including exposure settings)
      const generationRequest = {
        count,
        settings: {
          ...options,
        },
        // Always include exposure settings
        exposureSettings: options.exposureSettings || exposureSettings,
        // Include stack exposure targets
        stackExposureTargets: exposureSettings.stackExposureTargets,
      };

      // DEBUG: Log what we're actually sending
      console.log("🚀 SENDING LINEUP REQUEST:", {
        count,
        hasStackTargets: !!exposureSettings.stackExposureTargets,
        stackTargetsCount: Object.keys(
          exposureSettings.stackExposureTargets || {}
        ).length,
        stackTargets: exposureSettings.stackExposureTargets,
      });

      // Call the API to generate lineups
      const response = await fetch(`http://localhost:3001/lineups/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(generationRequest),
      });

      if (!response.ok) {
        let errorMessage = `Lineup generation failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          try {
            const errorText = await response.text();
            if (errorText) errorMessage += ` - ${errorText}`;
          } catch (textError) {
            // Ignore if we can't get text either
          }
        }
        throw new Error(errorMessage);
      }

      // Get the generated lineups
      const result = await response.json();

      if (result.lineups && Array.isArray(result.lineups)) {
        // Add NexusScore to each lineup
        const enhancedLineups = result.lineups.map((lineup) => {
          // Calculate NexusScore based on lineup data
          const allPlayers = lineup.cpt
            ? [lineup.cpt, ...(lineup.players || [])]
            : lineup.players || [];
          const teamCounts = {};

          allPlayers.forEach((player) => {
            if (player && player.team) {
              teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
            }
          });

          // Calculate total projection
          let totalProj = 0;
          if (lineup.cpt) {
            const cptPlayer = playerData.find((p) => p.id === lineup.cpt.id);
            const cptProj = cptPlayer?.projectedPoints || 0;
            totalProj += cptProj * 1.5; // CPT gets 1.5x
          }

          // Add regular players' projections
          totalProj += (lineup.players || [])
            .map((p) => {
              const fullPlayer = playerData.find((fp) => fp.id === p.id);
              return fullPlayer?.projectedPoints || p.projectedPoints || 0;
            })
            .reduce((sum, proj) => sum + proj, 0);

          // Calculate average ownership
          const totalOwnership = allPlayers.reduce((sum, p) => {
            const fullPlayer = playerData.find((fp) => fp.id === p.id);
            return sum + (fullPlayer?.ownership || p.ownership || 0);
          }, 0);

          const avgOwn =
            allPlayers.length > 0 ? totalOwnership / allPlayers.length : 0;

          // Calculate stack bonus
          let stackBonus = 0;
          Object.values(teamCounts).forEach((count) => {
            if (count >= 3) stackBonus += (count - 2) * 3;
          });

          // Calculate NexusScore
          const ownership = Math.max(0.1, avgOwn / 100);
          const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership));
          // Calculate NexusScore - scale to reasonable range (25-65)
          const baseScore = totalProj / 10;
          const nexusScore = Math.min(
            65,
            Math.max(25, baseScore * leverageFactor + stackBonus / 2)
          );

          return {
            ...lineup,
            nexusScore: Math.round(nexusScore * 10) / 10,
          };
        });

        setLineups((prevLineups) => {
          const existingIds = new Set(prevLineups.map((l) => l.id));
          const newLineups = enhancedLineups.filter(
            (l) => !existingIds.has(l.id)
          );
          return [...prevLineups, ...newLineups];
        });
        displayNotification(`Generated ${result.lineups.length} new lineups!`);

        // Switch to lineups tab after generation
        setActiveTab("lineups");
        return enhancedLineups;
      } else {
        throw new Error("Invalid response format for lineup generation");
      }
    } catch (error) {
      console.error("Lineup generation error:", error);
      displayNotification(
        `Error generating lineups: ${error.message}`,
        "error"
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generateOptimizedLineups };
};
