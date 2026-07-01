"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createAssessment } from "@/app/dashboard/actions";
import type { CreateAssessmentFormState } from "@/app/dashboard/actions";
import type {
  AssessmentTechnology,
  CodebaseTemplateOption,
  RubricSource,
} from "@/app/dashboard/data";

type CreateAssessmentFormProps = {
  templates: CodebaseTemplateOption[];
};

const assessmentTechnologyLabels: Record<AssessmentTechnology, string> = {
  python: "Python",
  react_javascript: "React (JavaScript)",
};

const initialCreateAssessmentState: CreateAssessmentFormState = {
  status: "idle",
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
      {message}
    </p>
  );
}

export function CreateAssessmentForm({ templates }: CreateAssessmentFormProps) {
  const [state, formAction, pending] = useActionState(
    createAssessment,
    initialCreateAssessmentState,
  );
  const [rubricSource, setRubricSource] =
    useState<RubricSource>("generated");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const minimumExpirationDate = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const technologyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          templates.flatMap((template) => template.technologies),
        ),
      ),
    [templates],
  );

  return (
    <form
      action={formAction}
      className="mt-6 max-w-[760px] rounded-[8px] border border-[#f0eeea] bg-white p-4"
      encType="multipart/form-data"
    >
      <div className="grid gap-4">
        {state.message ? (
          <p
            className="rounded-[6px] border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="status"
          >
            {state.message}
          </p>
        ) : null}

        <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
          Title
          <input
            className="h-10 rounded-[3px] border border-[#dedbd5] bg-white px-3 text-[13px] outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
            name="title"
            placeholder="Frontend intern code review"
            required
          />
          <FieldError message={state.fieldErrors?.title} />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[#202322]">
          <span className="flex items-center justify-between gap-3">
            Time limit
            <span className="text-xs font-semibold text-[#62675e]">
              {timeLimitMinutes} minutes
            </span>
          </span>
          <input
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#efeeeb] accent-[#202322]"
            max={60}
            min={20}
            name="timeLimitMinutes"
            onChange={(event) => setTimeLimitMinutes(Number(event.target.value))}
            step={5}
            type="range"
            value={timeLimitMinutes}
          />
          <div className="flex justify-between text-xs font-medium text-[#62675e]">
            <span>20m</span>
            <span>60m</span>
          </div>
          <FieldError message={state.fieldErrors?.timeLimitMinutes} />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
          Expiration date
          <input
            className="h-10 rounded-[3px] border border-[#dedbd5] bg-white px-3 text-[13px] outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
            min={minimumExpirationDate}
            name="expirationDate"
            required
            type="date"
          />
          <FieldError message={state.fieldErrors?.expirationDate} />
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-[#202322]">
            Technologies
          </legend>
          {technologyOptions.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {technologyOptions.map((technology) => (
                <label
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[3px] border border-[#dedbd5] px-3 text-sm font-medium text-[#4f554d] transition duration-150 has-[:checked]:border-[#202322] has-[:checked]:bg-[#fbfaf7] has-[:checked]:font-semibold has-[:checked]:text-[#202322]"
                  key={technology}
                >
                  <input
                    className="accent-[#202322]"
                    defaultChecked
                    name="technologies"
                    type="checkbox"
                    value={technology}
                  />
                  {assessmentTechnologyLabels[technology]}
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-3 py-2 text-sm text-[#7a3a27]">
              No codebase technologies are available.
            </p>
          )}
          <FieldError message={state.fieldErrors?.technologies} />
        </fieldset>

        <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
          <span className="flex items-center gap-1.5">
            Codebase specification
            <span className="text-xs font-normal text-[#9aa093]">optional</span>
          </span>
          <textarea
            className="min-h-[100px] rounded-[3px] border border-[#dedbd5] bg-white px-3 py-2 text-[13px] leading-6 outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
            name="codbbaseSpec"
            placeholder="Describe the domain, topics to test, and depth. E.g. 'logistics platform with a caching layer and async job queue — test API design, cache invalidation, and N+1 queries. Include a background worker and DB access layer.' More detail = more tailored codebase."
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
          Job description
          <textarea
            className="min-h-[150px] rounded-[3px] border border-[#dedbd5] bg-white px-3 py-2 text-[13px] leading-6 outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
            name="jobDescription"
            placeholder="Frontend intern role focused on React debugging, code review, and product-minded engineering."
            required
          />
          <FieldError message={state.fieldErrors?.jobDescription} />
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-[#202322]">Rubric</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["generated", "uploaded"] as const).map((option) => (
              <label
                className={
                  rubricSource === option
                    ? "flex min-h-10 cursor-pointer items-center gap-2 rounded-[3px] border border-[#202322] bg-[#fbfaf7] px-3 text-sm font-semibold"
                    : "flex min-h-10 cursor-pointer items-center gap-2 rounded-[3px] border border-[#dedbd5] px-3 text-sm font-medium text-[#4f554d]"
                }
                key={option}
              >
                <input
                  checked={rubricSource === option}
                  className="accent-[#202322]"
                  name="rubricSource"
                  onChange={() => setRubricSource(option)}
                  type="radio"
                  value={option}
                />
                {option === "generated" ? "Generate" : "Upload"}
              </label>
            ))}
          </div>
          <FieldError message={state.fieldErrors?.rubricSource} />
        </fieldset>

        {rubricSource === "uploaded" ? (
          <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
            Rubric file
            <input
              accept=".md,.txt"
              className="h-10 rounded-[3px] border border-[#dedbd5] bg-white px-3 py-2 text-[13px] outline-none file:mr-3 file:border-0 file:bg-[#efeeeb] file:px-3 file:py-1 file:text-xs file:font-semibold"
              name="rubricFile"
              type="file"
            />
            <FieldError message={state.fieldErrors?.rubricFile} />
          </label>
        ) : null}

        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[3px] bg-primary px-4 text-sm font-bold text-[#111510] transition duration-150 hover:bg-[#d7ff5a] disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
          disabled={pending || technologyOptions.length === 0}
          type="submit"
        >
          <Plus size={16} />
          {pending ? "Creating" : "Create assessment"}
        </button>
      </div>
    </form>
  );
}
