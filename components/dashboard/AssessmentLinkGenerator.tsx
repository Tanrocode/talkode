"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

type AssessmentLinkGeneratorProps = {
  accessCode: string;
  assessmentLink: string;
};

export function AssessmentLinkGenerator({
  accessCode,
  assessmentLink,
}: AssessmentLinkGeneratorProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(assessmentLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="border border-[#ebe8e1] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#62675e]">
            Candidate link
          </p>
          <p className="mt-2 font-mono text-[28px] font-black tracking-[0.14em] text-[#202322]">
            {accessCode}
          </p>
        </div>
        <a
          className="grid h-8 w-8 place-items-center rounded-[3px] border border-[#d8d5cf] text-[#202322] transition duration-150 hover:border-[#c7c2ba] hover:bg-[#fbfaf7]"
          href={assessmentLink}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink size={15} />
          <span className="sr-only">Open candidate link</span>
        </a>
      </div>

      <div className="mt-4 flex min-w-0 items-center gap-2">
        <input
          className="h-9 min-w-0 flex-1 rounded-[3px] border border-[#dedbd5] bg-[#fbfaf7] px-2.5 text-[12px] text-[#4f554d] outline-none"
          readOnly
          value={assessmentLink}
        />
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[3px] border border-[#d8d5cf] px-2.5 text-xs font-bold text-[#202322] transition duration-150 hover:border-[#c7c2ba] hover:bg-[#fbfaf7]"
          onClick={copyLink}
          type="button"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}
