"use client";

import { useActionState, useMemo, useState } from "react";
import { Clock3, Layers3, Plus } from "lucide-react";
import { createAssessment } from "@/app/dashboard/actions";
import type { CreateAssessmentFormState } from "@/app/dashboard/actions";
import type {
  AssessmentTechnology,
  CodebaseTemplateOption,
} from "@/app/dashboard/data";
import { predefinedRubricCriteria } from "@/lib/assessment-rubric";

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

const inputClass =
  "h-10 rounded-[3px] border border-[#dedbd5] bg-white px-3 text-[13px] outline-none transition duration-150 placeholder:text-[#9a9d96] focus:border-[#202322] focus:ring-2 focus:ring-[#e8f6c9]";

const labelClass = "grid gap-1.5 text-[13px] font-semibold text-[#202322]";

const sectionLabelClass =
  "font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#62675e]";

const rubricScale = [
  ["1", "Generic or unsupported"],
  ["2", "Partial code connection"],
  ["3", "Specific and correct"],
  ["4", "Deep system understanding"],
] as const;

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
      className="mt-6 max-w-[1120px] overflow-hidden rounded-[8px] border border-[#ebe8e1] bg-white shadow-[0_14px_40px_rgba(32,35,34,0.04)]"
    >
      {state.message ? (
        <p
          className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800"
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-5 p-5 sm:p-6">
          <div>
            <p className={sectionLabelClass}>Assessment setup</p>
            <div className="mt-4 grid gap-4">
              <label className={labelClass}>
                Title
                <input
                  className={inputClass}
                  name="title"
                  placeholder="Frontend intern code review"
                  required
                />
                <FieldError message={state.fieldErrors?.title} />
              </label>
            </div>
          </div>

          <label className={labelClass}>
            Job description
            <textarea
              className="min-h-[220px] rounded-[3px] border border-[#dedbd5] bg-white px-3 py-3 text-[13px] leading-6 outline-none transition duration-150 placeholder:text-[#9a9d96] focus:border-[#202322] focus:ring-2 focus:ring-[#e8f6c9]"
              name="jobDescription"
              placeholder="Frontend intern role focused on React debugging, code review, and product-minded engineering."
              required
            />
            <FieldError message={state.fieldErrors?.jobDescription} />
          </label>

          <fieldset className="grid gap-4">
            <legend className={sectionLabelClass}>Rubric criteria</legend>
            <p className="max-w-[760px] text-sm leading-6 text-[#62675e]">
              Select the requirements the interviewer should grade. Each row is
              saved as a 1-4 rubric item with evidence that must come from this
              codebase.
            </p>

            <div className="overflow-x-auto rounded-[6px] border border-[#ebe8e1]">
              <table className="min-w-[720px] border-collapse text-left text-[12px]">
                <thead className="bg-[#fbfaf7] text-[10px] font-bold uppercase tracking-[0.14em] text-[#62675e]">
                  <tr>
                    <th className="w-14 px-3 py-2" scope="col">
                      Use
                    </th>
                    <th className="w-[220px] px-3 py-2" scope="col">
                      Requirement
                    </th>
                    <th className="px-3 py-2" scope="col">
                      Evidence to collect
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebe8e1]">
                  {predefinedRubricCriteria.map((criterion) => (
                    <tr
                      className="align-top transition duration-150 hover:bg-[#fbfaf7]"
                      key={criterion.id}
                    >
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Assess ${criterion.label}`}
                          className="accent-[#202322]"
                          defaultChecked
                          name="rubricCriteria"
                          type="checkbox"
                          value={criterion.id}
                        />
                      </td>
                      <td className="px-3 py-3 text-[13px] font-bold text-[#202322]">
                        {criterion.label}
                      </td>
                      <td className="px-3 py-3 text-[12px] leading-5 text-[#62675e]">
                        {criterion.evidence}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <FieldError message={state.fieldErrors?.rubricCriteria} />

            <div className="grid gap-3">
              <p className={sectionLabelClass}>Rubric scale</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {rubricScale.map(([score, description]) => (
                  <div
                    className="min-w-0 rounded-[6px] border border-[#ebe8e1] bg-[#fbfaf7] px-3 py-3"
                    key={score}
                  >
                    <p className="text-lg font-black leading-none text-[#202322]">
                      {score}
                    </p>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-[#62675e]">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <label className={labelClass}>
              Add custom criteria
              <textarea
                className="min-h-[96px] rounded-[3px] border border-[#dedbd5] bg-white px-3 py-3 text-[13px] leading-6 outline-none transition duration-150 placeholder:text-[#9a9d96] focus:border-[#202322] focus:ring-2 focus:ring-[#e8f6c9]"
                name="customRubricCriteria"
                placeholder="One per line, e.g. Explains how failed API responses should surface in the UI."
              />
              <FieldError message={state.fieldErrors?.customRubricCriteria} />
            </label>
          </fieldset>
        </div>

        <aside className="grid content-start gap-5 border-t border-[#ebe8e1] bg-[#fbfaf7] p-5 lg:border-l lg:border-t-0">
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-primary px-4 text-sm font-black text-[#111510] shadow-[0_10px_24px_rgba(173,255,0,0.28)] transition duration-150 hover:bg-[#d7ff5a] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending || technologyOptions.length === 0}
            type="submit"
          >
            <Plus size={16} />
            {pending ? "Creating" : "Generate assessment"}
          </button>

          <div className="grid gap-5">
            <p className={sectionLabelClass}>Assessment details</p>

            <label className={labelClass}>
              Expiration date
              <input
                className={inputClass}
                min={minimumExpirationDate}
                name="expirationDate"
                required
                type="date"
              />
              <FieldError message={state.fieldErrors?.expirationDate} />
            </label>

            <label
              className={`${labelClass} rounded-[6px] border border-[#ebe8e1] bg-white p-3`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2">
                  <Clock3 size={14} />
                  Time limit
                </span>
                <span className="text-xs font-bold text-[#202322]">
                  {timeLimitMinutes} min
                </span>
              </span>
              <input
                className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e5e2dc] accent-[#202322]"
                max={60}
                min={20}
                name="timeLimitMinutes"
                onChange={(event) =>
                  setTimeLimitMinutes(Number(event.target.value))
                }
                step={5}
                type="range"
                value={timeLimitMinutes}
              />
              <div className="flex justify-between text-[11px] font-semibold text-[#72766f]">
                <span>20m</span>
                <span>60m</span>
              </div>
              <FieldError message={state.fieldErrors?.timeLimitMinutes} />
            </label>

            <fieldset className="grid gap-2">
              <legend className={sectionLabelClass}>Technologies</legend>
              {technologyOptions.length > 0 ? (
                <div className="grid gap-2">
                  {technologyOptions.map((technology) => (
                    <label
                      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[6px] border border-[#dedbd5] bg-white px-3 text-[13px] font-semibold text-[#4f554d] transition duration-150 hover:border-[#c8c2b8] has-[:checked]:border-[#202322] has-[:checked]:bg-[#fbfaf7] has-[:checked]:text-[#202322]"
                      key={technology}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Layers3 className="shrink-0" size={14} />
                        <span className="truncate">
                          {assessmentTechnologyLabels[technology]}
                        </span>
                      </span>
                      <input
                        className="shrink-0 accent-[#202322]"
                        defaultChecked
                        name="technologies"
                        type="checkbox"
                        value={technology}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-3 py-2 text-sm text-[#7a3a27]">
                  No Supabase codebase technologies are available.
                </p>
              )}
              <FieldError message={state.fieldErrors?.technologies} />
            </fieldset>
          </div>
        </aside>
      </div>
    </form>
  );
}
