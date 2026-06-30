"use client";

import { useActionState, useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";
import {
  updateAssessment,
  type UpdateAssessmentFormState,
} from "@/app/dashboard/actions";
import type {
  AssessmentTechnology,
  DashboardAssessment,
} from "@/app/dashboard/data";

type EditAssessmentFormProps = {
  assessment: DashboardAssessment;
};

const assessmentTechnologyLabels: Record<AssessmentTechnology, string> = {
  python: "Python",
  react_javascript: "React (JavaScript)",
};

const technologyOptions = Object.keys(
  assessmentTechnologyLabels,
) as AssessmentTechnology[];

const initialState: UpdateAssessmentFormState = { status: "idle" };

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

export function EditAssessmentForm({ assessment }: EditAssessmentFormProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateAssessment,
    initialState,
  );
  const [lastHandledStatus, setLastHandledStatus] = useState(state.status);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    assessment.timeLimitMinutes,
  );
  const minimumExpirationDate = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );
  const defaultExpirationDate = assessment.dueAt
    ? assessment.dueAt.slice(0, 10)
    : minimumExpirationDate;

  if (state.status !== lastHandledStatus) {
    setLastHandledStatus(state.status);
    if (state.status === "success") {
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[#62675e]">
            Job description
          </p>
          <button
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#55594f] transition duration-150 hover:text-[#202322]"
            onClick={() => setEditing(true)}
            type="button"
          >
            <Pencil size={12} />
            Edit
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4f554d]">
          {assessment.jobDescription}
        </p>

        <div className="mt-5 border-t border-[#f0eeea] pt-4">
          <p className="text-xs font-semibold text-[#62675e]">
            Rubric{" "}
            <span className="font-normal text-[#9aa093]">
              ({assessment.rubricSource === "uploaded" ? "uploaded" : "generated"})
            </span>
          </p>
          {assessment.rubricText ? (
            <pre className="mt-2 whitespace-pre-wrap rounded-[6px] border border-[#f0eeea] bg-[#fbfaf7] p-4 text-sm leading-6 text-[#4f554d]">
              {assessment.rubricText}
            </pre>
          ) : (
            <p className="mt-2 text-sm text-[#62675e]">
              No rubric is attached to this assessment yet.
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input name="assessmentId" type="hidden" value={assessment.id} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#62675e]">
          Edit assessment
        </p>
        <button
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#55594f] transition duration-150 hover:text-[#202322]"
          onClick={() => setEditing(false)}
          type="button"
        >
          <X size={12} />
          Cancel
        </button>
      </div>

      {assessment.candidateCount > 0 ? (
        <p className="rounded-[6px] border border-[#f0d9a6] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#6b4e16]">
          {assessment.candidateCount}{" "}
          {assessment.candidateCount === 1 ? "candidate has" : "candidates have"}{" "}
          already taken this assessment. Changes only affect candidates who
          join after you save.
        </p>
      ) : null}

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
          defaultValue={assessment.title}
          name="title"
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
          defaultValue={defaultExpirationDate}
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
        <div className="grid gap-2 sm:grid-cols-2">
          {technologyOptions.map((technology) => (
            <label
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[3px] border border-[#dedbd5] px-3 text-sm font-medium text-[#4f554d] transition duration-150 has-[:checked]:border-[#202322] has-[:checked]:bg-[#fbfaf7] has-[:checked]:font-semibold has-[:checked]:text-[#202322]"
              key={technology}
            >
              <input
                className="accent-[#202322]"
                defaultChecked={assessment.technologies.includes(technology)}
                name="technologies"
                type="checkbox"
                value={technology}
              />
              {assessmentTechnologyLabels[technology]}
            </label>
          ))}
        </div>
        <FieldError message={state.fieldErrors?.technologies} />
      </fieldset>

      <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
        Job description
        <textarea
          className="min-h-[150px] rounded-[3px] border border-[#dedbd5] bg-white px-3 py-2 text-[13px] leading-6 outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
          defaultValue={assessment.jobDescription}
          name="jobDescription"
          required
        />
        <FieldError message={state.fieldErrors?.jobDescription} />
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
        Rubric
        <textarea
          className="min-h-[220px] rounded-[3px] border border-[#dedbd5] bg-white px-3 py-2 font-mono text-[13px] leading-6 outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
          defaultValue={assessment.rubricText}
          name="rubricText"
        />
        <FieldError message={state.fieldErrors?.rubricText} />
      </label>

      <div className="flex items-center gap-2">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[3px] bg-primary px-4 text-sm font-bold text-[#111510] transition duration-150 hover:bg-[#d7ff5a] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving" : "Save changes"}
        </button>
        <button
          className="inline-flex h-10 items-center justify-center rounded-[3px] px-4 text-sm font-semibold text-[#55594f] transition duration-150 hover:text-[#202322]"
          disabled={pending}
          onClick={() => setEditing(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
