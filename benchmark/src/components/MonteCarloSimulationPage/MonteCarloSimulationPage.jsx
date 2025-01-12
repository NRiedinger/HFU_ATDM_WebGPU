import "./MonteCarloSimulationPage.css";

import { run } from "../../../../calculatePI/pi.js";
import { useEffect, useState } from "react";
import { Divider } from "primereact/divider";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/Button";

const MonteCarloSimulationPage = () => {
  const [numGPUPasses, setNumGPUPasses] = useState(1);
  const [numIterations, setNumIterations] = useState(1_000_000);
  const [numGPUThreads, setNumGPUThreads] = useState(64_000);

  const [showResultSingle, setShowResultSingle] = useState(false);
  const [resultSingleTotalSamples, setResultSingleTotalSamples] = useState();
  const [resultSinglePositiveSamples, setResultSinglePositiveSamples] =
    useState();
  const [resultSinglePI, setResultSinglePI] = useState();

  const onRunSingle = () => {
    setShowResultSingle(false);
    run(numGPUPasses, numIterations, numGPUThreads).then((result) => {
      setResultSingleTotalSamples(result.totalSamples);
      setResultSinglePositiveSamples(result.positiveSamples);
      setResultSinglePI(result.pi);
      setShowResultSingle(true);
    });
  };

  const renderResultSingle = () => {
    return (
      <div className="MonteCarloSimulationPage__ResultSingle__Container">
        <span>Total Samples: {resultSingleTotalSamples}</span>
        <span>Positive Samples: {resultSinglePositiveSamples}</span>
        <span>Calculated PI: {resultSinglePI}</span>
        <span>Math.PI: {Math.PI}</span>
      </div>
    );
  };

  return (
    <div className="MonteCarloSimulationPage">
      <div className="MonteCarloSimulationPage__Container">
        <div className="MonteCarloSimulationPage__Container__Column">
          <h3>Einzel</h3>
          <Divider />
          <FloatLabel>
            <InputNumber
              inputId="input-gpupasses"
              min={1}
              value={numGPUPasses}
              onValueChange={(e) => setNumGPUPasses(e.value)}
            />
            <label htmlFor="input-gpupasses">Anzahl Durchläufe</label>
          </FloatLabel>

          <FloatLabel>
            <InputNumber
              inputId="input-gputhreads"
              min={1}
              value={numGPUThreads}
              onValueChange={(e) => setNumGPUThreads(e.value)}
            />
            <label htmlFor="input-gputhreads">Anzahl GPU-Threads</label>
          </FloatLabel>

          <FloatLabel>
            <InputNumber
              inputId="input-iterations"
              min={1}
              value={numIterations}
              onValueChange={(e) => setNumIterations(e.value)}
            />
            <label htmlFor="input-iterations">
              Anzahl Iterationen (pro GPU-Thread)
            </label>
          </FloatLabel>

          <Button label="Los" onClick={() => onRunSingle()} />

          <Divider />

          {showResultSingle ? renderResultSingle() : null}
        </div>
        <Divider layout="vertical" />
      </div>
    </div>
  );
};
export default MonteCarloSimulationPage;
