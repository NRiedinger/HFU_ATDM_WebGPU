import "./MonteCarloSimulationPage.css";

import MonteCarloSimulationSingle from "../MonteCarloSimulationSingle/MonteCarloSimulationSingle.jsx";
import MonteCarloSimulationMulti from "../MonteCarloSimulationMulti/MonteCarloSimulationMulti.jsx";

import { Divider } from "primereact/divider";

const MonteCarloSimulationPage = () => {
  return (
    <div className="MonteCarloSimulationPage">
      <div className="MonteCarloSimulationPage__Container">
        <div className="MonteCarloSimulationPage__Container__Column">
          <MonteCarloSimulationSingle />
        </div>
        <Divider layout="vertical" />

        <div className="MonteCarloSimulationPage__Container__Column Multi">
          <MonteCarloSimulationMulti />
        </div>
      </div>
    </div>
  );
};
export default MonteCarloSimulationPage;
