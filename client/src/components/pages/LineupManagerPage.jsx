import React from "react";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useNotification } from "../../contexts/NotificationContext";
import { lineupService } from "../../services";
import LineupList from "../features/lineup-management/LineupList";

const LineupManagerPage = () => {
  const { lineups, setLineups } = useLineup();
  const { playerData, contestInfo } = usePlayer();
  const { displayNotification } = useNotification();

  const handleDelete = async (lineupId) => {
    try {
      await lineupService.deleteLineup(lineupId);
      setLineups(lineups.filter((lineup) => lineup.id !== lineupId));
      displayNotification("Lineup deleted successfully");
    } catch (error) {
      displayNotification(`Error deleting lineup: ${error.message}`, "error");
    }
  };

  const handleEdit = (lineup) => {
    // TODO: Implement lineup editing
    console.log("Edit lineup:", lineup);
  };

  const handleExport = async (format) => {
    try {
      await lineupService.exportLineups(format, { lineups });
      displayNotification(`Lineups exported as ${format.toUpperCase()}`);
    } catch (error) {
      displayNotification(`Error exporting lineups: ${error.message}`, "error");
    }
  };

  return (
    <LineupList
      lineups={lineups}
      playerData={playerData}
      onDelete={handleDelete}
      onEdit={handleEdit}
      onExport={handleExport}
      contestInfo={contestInfo}
    />
  );
};

export default LineupManagerPage;
