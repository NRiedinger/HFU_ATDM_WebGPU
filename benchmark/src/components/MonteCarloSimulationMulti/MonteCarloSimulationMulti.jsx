import "./MonteCarloSimulationMulti.css";

import { useState } from "react";
import { Divider } from "primereact/divider";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/Button";
import { ProgressSpinner } from "primereact/progressspinner";
import { ProgressBar } from "primereact/progressbar";
import { Chart } from "primereact/chart";

import { runCPU, runGPUbySamples } from "../../../../calculatePI/pi.js";

const options = {
  maintainAspectRatio: false,
  aspectRatio: 0.6,
  plugins: {
    legend: {
      labels: {
        color: "black",
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: "black",
      },
      grid: {
        color: "lightgrey",
      },
      title: {
        text: "Samples",
        display: true,
      },
    },
    y: {
      ticks: {
        color: "black",
      },
      grid: {
        color: "lightgrey",
      },
      title: {
        text: "Zeit [ms]",
        display: true,
      },
    },
  },
};

const MonteCarloSimulationMulti = () => {
  const [numSampleSteps, setNumSampleSteps] = useState(10);
  const [sampleStepSize, setSampleStepSize] = useState(6_400_000);
  const [numTestRunsPerSampleStep, setNumTestRunsPerSampleStep] = useState(5);
  const [numGPUThreads, setNumGPUThreads] = useState(64_000);

  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onRun = async () => {
    setIsLoading(true);
    const valuesCPU = [];
    const valuesGPU = [];
    const valuesSamples = [];

    for (let step = 1; step <= numSampleSteps; step++) {
      const durationsCPU = [];
      const durationsGPU = [];
      const numSamples = step * sampleStepSize;
      console.log(
        `Running ${step} / ${numSampleSteps} (${numSamples.toLocaleString()} samples)`
      );

      for (let i = 0; i < numTestRunsPerSampleStep; i++) {
        const resultCPU = await runCPU(numSamples);
        const resultGPU = await runGPUbySamples(numSamples, numGPUThreads);

        durationsCPU.push(resultCPU.duration);
        durationsGPU.push(resultGPU.duration);
      }

      setProgress((step / numSampleSteps) * 100);

      valuesSamples.push(numSamples.toLocaleString());
      valuesCPU.push(
        durationsCPU.reduce((a, b) => a + b, 0) / numTestRunsPerSampleStep
      );
      valuesGPU.push(
        durationsGPU.reduce((a, b) => a + b, 0) / numTestRunsPerSampleStep
      );
    }

    const data = {
      labels: valuesSamples,
      datasets: [
        {
          label: "CPU",
          data: valuesCPU,
          fill: false,
          borderColor: "#3B82EF",
          tension: 0.4,
        },
        {
          label: "GPU",
          data: valuesGPU,
          fill: false,
          borderColor: "#F54696",
          tension: 0.4,
        },
      ],
    };

    setChartData(data);
    setChartOptions(options);

    setIsLoading(false);
  };

  return (
    <div className="MonteCarloSimulationMulti">
      <h3>Mehrfach</h3>
      <Divider />

      <div className="MonteCarloSimulationMulti__Container">
        <div className="MonteCarloSimulationMulti__UI">
          <FloatLabel>
            <InputNumber
              inputId="input-numsamplesteps"
              min={1}
              allowEmpty={false}
              value={numSampleSteps}
              onValueChange={(e) => setNumSampleSteps(e.value)}
            />
            <label htmlFor="input-numsamplesteps">Anzahl Schritte</label>
          </FloatLabel>

          <FloatLabel>
            <InputNumber
              inputId="input-samplestepsize"
              min={1}
              allowEmpty={false}
              value={sampleStepSize}
              onValueChange={(e) => setSampleStepSize(e.value)}
            />
            <label htmlFor="input-samplestepsize">Schrittweite</label>
          </FloatLabel>

          <FloatLabel>
            <InputNumber
              inputId="input-runspersamplestep"
              min={1}
              allowEmpty={false}
              value={numTestRunsPerSampleStep}
              onValueChange={(e) => setNumTestRunsPerSampleStep(e.value)}
            />
            <label htmlFor="input-runspersamplestep">
              Durchläufe pro Schritt
            </label>
          </FloatLabel>

          <FloatLabel>
            <InputNumber
              inputId="input-numgputhreads"
              min={1}
              allowEmpty={false}
              value={numGPUThreads}
              onValueChange={(e) => setNumGPUThreads(e.value)}
            />
            <label htmlFor="input-numgputhreads">Anzahl GPU Threads</label>
          </FloatLabel>

          <Button label="Los" onClick={() => onRun()} />
        </div>

        <div className="MonteCarloSimulationMulti__Chart">
          {isLoading ? (
            <ProgressBar value={progress} />
          ) : (
            <Chart type="line" data={chartData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
};
export default MonteCarloSimulationMulti;
