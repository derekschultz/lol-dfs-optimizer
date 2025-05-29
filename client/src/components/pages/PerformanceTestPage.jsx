import React from "react";
import { usePlayer } from "../../contexts/PlayerContext";
import PerformanceTest from "../PerformanceTest";

const PerformanceTestPage = () => {
  const { playerData, stackData } = usePlayer();

  return (
    <PerformanceTest playerProjections={playerData} teamStacks={stackData} />
  );
};

export default PerformanceTestPage;
