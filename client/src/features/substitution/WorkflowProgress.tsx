import { WORKFLOW_STEPS } from "./constants";
import type { WorkflowStep } from "./types";

interface WorkflowProgressProps {
  currentStep: WorkflowStep;
}

export default function WorkflowProgress({
  currentStep,
}: WorkflowProgressProps) {
  const currentStepIndex = WORKFLOW_STEPS.indexOf(currentStep);

  return (
    <div className="mb-8 flex items-center justify-between">
      {WORKFLOW_STEPS.map((step, idx) => {
        const isCurrent = currentStep === step;
        const isCompleted = currentStepIndex > idx;

        return (
          <div key={step} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                isCurrent
                  ? "bg-blue-600 text-white"
                  : isCompleted
                    ? "bg-green-600 text-white"
                    : "bg-gray-300 text-gray-600"
              }`}
            >
              {idx + 1}
            </div>
            {idx < WORKFLOW_STEPS.length - 1 && (
              <div
                className={`w-16 h-1 mx-2 ${isCompleted ? "bg-green-600" : "bg-gray-300"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
