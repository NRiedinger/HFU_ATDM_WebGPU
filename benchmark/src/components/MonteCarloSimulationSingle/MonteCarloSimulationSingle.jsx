import "./MonteCarloSimulationSingle.css";

import { useState } from "react";
import { runCPU, runGPU } from "../../../../calculatePI/pi.js";

import { Divider } from "primereact/divider";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/Button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressSpinner } from "primereact/progressspinner";
import { Dropdown } from "primereact/dropdown";

const deviceOptions = [{ value: "GPU" }, { value: "CPU" }];

const MonteCarloSimulationSingle = () => {
  const [selectedDevice, setSelectedDevice] = useState("GPU");
  const [numGPUPasses, setNumGPUPasses] = useState(1);
  const [numGPUIterations, setNumGPUIterations] = useState(10_000);
  const [numGPUThreads, setNumGPUThreads] = useState(64_000);
  const [numCPUIterations, setNumCPUIterations] = useState(64_000);

  const [showResult, setShowResult] = useState(false);
  const [isResultLoading, setIsResultLoading] = useState(false);
  const [resultsGPU, setResultsGPU] = useState([]);
  const [resultsCPU, setResultsCPU] = useState([]);

  const renderResultGPU = () => {
    return (
      <DataTable showHeaders={false} value={resultsGPU}>
        <Column field="name" header="Name" />
        <Column field="value" header="Value" />
      </DataTable>
    );
  };

  const renderResultCPU = () => {
    return (
      <DataTable showHeaders={false} value={resultsCPU}>
        <Column field="name" header="Name" />
        <Column field="value" header="Value" />
      </DataTable>
    );
  };

  const onRun = async () => {
    setShowResult(false);
    setIsResultLoading(true);

    let result;
    if (selectedDevice === "GPU") {
      result = await runGPU(numGPUPasses, numGPUIterations, numGPUThreads);
    } else {
      result = await runCPU(numCPUIterations);
    }
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
            100 * Math.abs((result.pi - Math.PI) / ((result.pi + Math.PI) / 2))
          ).toFixed(10) + " %",
      },
      {
        name: "Total Duration",
        value: result.duration.toFixed(2) + " ms",
      },
    ];

    if (selectedDevice === "GPU") {
      results.push({
        name: "Compute Pass Duration",
        value: result.computePassDuration.toFixed(5) + " ms",
      });

      setResultsGPU(results);
    } else {
      setResultsCPU(results);
    }

    setShowResult(true);
    setIsResultLoading(false);
  };

  const renderUIGPU = () => {
    return (
      <>
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
            inputId="input-gpuiterations"
            min={1}
            allowEmpty={false}
            value={numGPUIterations}
            onValueChange={(e) => setNumGPUIterations(e.value)}
          />
          <label htmlFor="input-gpuiterations">
            Anzahl Iterationen (pro GPU-Thread)
          </label>
        </FloatLabel>
      </>
    );
  };

  const renderUICPU = () => {
    return (
      <>
        <FloatLabel>
          <InputNumber
            inputId="input-cpuiterations"
            min={1}
            allowEmpty={false}
            value={numCPUIterations}
            onValueChange={(e) => setNumCPUIterations(e.value)}
          />
          <label htmlFor="input-cpuiterations">Anzahl Iterationen</label>
        </FloatLabel>
      </>
    );
  };

  return (
    <div className="MonteCarloSimulationSingle">
      <h3>Einzel</h3>
      <Divider />

      <FloatLabel>
        <Dropdown
          id="device-dropdown"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.value)}
          options={deviceOptions}
          optionLabel="value"
          optionValue="value"
        />
        <label htmlFor="renderer-dropdown">Renderer</label>
      </FloatLabel>

      {selectedDevice === "GPU" ? renderUIGPU() : renderUICPU()}

      <Button label="Los" onClick={() => onRun()} />

      <Divider />

      <div className="MonteCarloSimulationSingle__Result__Container">
        {showResult ? (
          selectedDevice === "GPU" ? (
            renderResultGPU()
          ) : (
            renderResultCPU()
          )
        ) : isResultLoading ? (
          <ProgressSpinner />
        ) : null}
      </div>
    </div>
  );
};
export default MonteCarloSimulationSingle;
