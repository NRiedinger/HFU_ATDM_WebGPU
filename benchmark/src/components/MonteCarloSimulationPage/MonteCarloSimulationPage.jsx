import "./MonteCarloSimulationPage.css";

import { run } from "../../../../calculatePI/pi.js";
import { useEffect, useState } from "react";
import { Divider } from "primereact/divider";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/Button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressSpinner } from "primereact/progressspinner";

const MonteCarloSimulationPage = () => {
  const [numGPUPasses, setNumGPUPasses] = useState(1);
  const [numIterations, setNumIterations] = useState(10_000);
  const [numGPUThreads, setNumGPUThreads] = useState(64_000);

  const [showResultSingle, setShowResultSingle] = useState(false);
  const [resultSingleLoading, setResultSingleLoading] = useState(false);
  const [resultsSingle, setResultsSingle] = useState([]);

  const onRunSingle = () => {
    setShowResultSingle(false);
    setResultSingleLoading(true);
    run(numGPUPasses, numIterations, numGPUThreads).then((result) => {
      const results = [
        {
          name: "Total Samples",
          value: result.totalSamples.toLocaleString(),
        },
        {
          name: "Positive Samples",
          value: result.positiveSamples.toLocaleString(),
        },
        {
          name: "Calculated PI",
          value: result.pi.toFixed(15),
        },
        {
          name: "Math.PI",
          value: Math.PI.toFixed(15),
        },
        {
          name: "Difference",
          value:
            (
              100 *
              Math.abs((result.pi - Math.PI) / ((result.pi + Math.PI) / 2))
            ).toFixed(10) + " %",
        },
        {
          name: "Total Duration",
          value: result.duration.toFixed(2) + " ms",
        },
        {
          name: "Compute Pass Duration",
          value: result.computePassDuration.toFixed(5) + " ms",
        },
      ];
      setResultsSingle(results);

      setShowResultSingle(true);
      setResultSingleLoading(false);
    });
  };

  const renderResultSingle = () => {
    return (
      <DataTable showHeaders={false} value={resultsSingle}>
        <Column field="name" header="Name" />
        <Column field="value" header="Value" />
      </DataTable>
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
              allowEmpty={false}
              value={numGPUPasses}
              onValueChange={(e) => setNumGPUPasses(e.value)}
            />
            <label htmlFor="input-gpupasses">Anzahl Durchläufe</label>
          </FloatLabel>

          <FloatLabel>
            <InputNumber
              inputId="input-gputhreads"
              min={1}
              allowEmpty={false}
              value={numGPUThreads}
              onValueChange={(e) => setNumGPUThreads(e.value)}
            />
            <label htmlFor="input-gputhreads">Anzahl GPU-Threads</label>
          </FloatLabel>

          <FloatLabel>
            <InputNumber
              inputId="input-iterations"
              min={1}
              allowEmpty={false}
              value={numIterations}
              onValueChange={(e) => setNumIterations(e.value)}
            />
            <label htmlFor="input-iterations">
              Anzahl Iterationen (pro GPU-Thread)
            </label>
          </FloatLabel>

          <Button label="Los" onClick={() => onRunSingle()} />

          <Divider />

          <div className="MonteCarloSimulationPage__ResultSingle__Container">
            {showResultSingle ? (
              renderResultSingle()
            ) : resultSingleLoading ? (
              <ProgressSpinner />
            ) : null}
          </div>
        </div>
        <Divider layout="vertical" />
      </div>
    </div>
  );
};
export default MonteCarloSimulationPage;
