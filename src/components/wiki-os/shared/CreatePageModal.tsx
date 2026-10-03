"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  Plus,
  EditPencil as PenTool,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { generateWikitext } from "./create-page/WikitextTemplates";
import { TitleStep } from "./create-page/TitleStep";
import { TypeStep } from "./create-page/TypeStep";
import { MetadataStep } from "./create-page/MetadataStep";

interface CreatePageModalProps {
  open: boolean;
  onClose: () => void;
}

export type PageType =
  "blank" | "person" | "company" | "history" | "country" | "conflict" | "politics" | "tech";

export function CreatePageModal({ open, onClose }: CreatePageModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
  const [rememberChoice, setRememberChoice] = useState(false);
  const [pageType, setPageType] = useState<PageType>("blank");
  const [existsWarning, setExistsWarning] = useState(false);

  // Form Fields
  const [personFields, setPersonFields] = useState({
    birthDate: "",
    birthPlace: "",
    nationality: "",
    occupation: "",
  });
  const [companyFields, setCompanyFields] = useState({
    type: "",
    industry: "",
    founder: "",
    headquarters: "",
  });
  const [historyFields, setHistoryFields] = useState({
    date: "",
    location: "",
    participants: "",
    result: "",
  });
  const [countryFields, setCountryFields] = useState({
    capital: "",
    governmentType: "",
    leaderName: "",
    currency: "",
  });
  const [conflictFields, setConflictFields] = useState({
    date: "",
    place: "",
    combatant1: "",
    combatant2: "",
  });
  const [politicsFields, setPoliticsFields] = useState({
    leader: "",
    founder: "",
    ideology: "",
    colors: "",
  });
  const [techFields, setTechFields] = useState({ inventor: "", year: "", application: "" });

  const inputRef = useRef<HTMLInputElement>(null);

  // Check exists query
  const checkExists = api.wikios.checkPageExists.useQuery(
    { title: title.trim() },
    { enabled: false }
  );

  useEffect(() => {
    if (open) {
      // oxlint-disable-next-line
      setStep(1);

      // Try to read title and page type from URL search parameters
      let initialTitle = "";
      let initialType: PageType = "blank";
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        initialTitle = params.get("wiki_title") || params.get("title") || "";
        const typeParam = params.get("wiki_type") || params.get("type");
        if (
          typeParam &&
          [
            "blank",
            "person",
            "company",
            "history",
            "country",
            "conflict",
            "politics",
            "tech",
          ].includes(typeParam)
        ) {
          initialType = typeParam as PageType;
        }
      }

      setTitle(initialTitle);
      const stored = localStorage.getItem("wikios:preferredEditor");
      if (stored === "visual" || stored === "source") {
        setEditorMode(stored);
        setRememberChoice(true);
      } else {
        setEditorMode("visual");
        setRememberChoice(false);
      }
      setPageType(initialType);
      setExistsWarning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleEditorModeChange = (mode: "visual" | "source") => {
    setEditorMode(mode);
    if (rememberChoice) {
      localStorage.setItem("wikios:preferredEditor", mode);
    }
  };

  const handleRememberChoiceChange = (checked: boolean) => {
    setRememberChoice(checked);
    if (checked) {
      localStorage.setItem("wikios:preferredEditor", editorMode);
    } else {
      localStorage.removeItem("wikios:preferredEditor");
    }
  };

  if (!open) return null;

  const handleNext = async () => {
    if (!title.trim()) return;

    if (step === 1) {
      const res = await checkExists.refetch();
      if (res.data?.exists) {
        setExistsWarning(true);
        return;
      }
      setExistsWarning(false);
      setStep(2);
    } else if (step === 2) {
      if (pageType === "blank") {
        handleCreate();
      } else {
        setStep(3);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const wikitext = generateWikitext(pageType, title, {
      personFields,
      companyFields,
      historyFields,
      countryFields,
      conflictFields,
      politicsFields,
      techFields,
    });
    onClose();

    const encodedTitle = encodeURIComponent(title.trim().replace(/ /g, "_"));
    const prefillParam = wikitext ? `&prefill=${encodeURIComponent(wikitext)}` : "";
    router.push(withBasePath(`/wiki/${encodedTitle}/edit?mode=${editorMode}${prefillParam}`));
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        aria-describedby={undefined}
        className="flex flex-col gap-0 overflow-y-auto sm:max-w-md"
      >
        {/* Header */}
        <div className="border-separator mb-4 flex items-center gap-2 border-b pr-10 pb-3">
          <PenTool className="text-tint size-5" aria-hidden="true" />
          <SheetTitle className="text-title-3">Create wiki page</SheetTitle>
        </div>

        {/* Steps */}
        {step === 1 && (
          <TitleStep
            title={title}
            setTitle={setTitle}
            editorMode={editorMode}
            setEditorMode={handleEditorModeChange}
            existsWarning={existsWarning}
            setExistsWarning={setExistsWarning}
            inputRef={inputRef}
            onClose={onClose}
            rememberChoice={rememberChoice}
            onRememberChoiceChange={handleRememberChoiceChange}
          />
        )}

        {step === 2 && <TypeStep pageType={pageType} setPageType={setPageType} />}

        {step === 3 && (
          <MetadataStep
            pageType={pageType}
            personFields={personFields}
            setPersonFields={setPersonFields}
            companyFields={companyFields}
            setCompanyFields={setCompanyFields}
            historyFields={historyFields}
            setHistoryFields={setHistoryFields}
            countryFields={countryFields}
            setCountryFields={setCountryFields}
            conflictFields={conflictFields}
            setConflictFields={setConflictFields}
            politicsFields={politicsFields}
            setPoliticsFields={setPoliticsFields}
            techFields={techFields}
            setTechFields={setTechFields}
          />
        )}

        {/* Footer actions */}
        <div className="border-separator mt-6 flex items-center justify-between border-t pt-4">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ChevronLeft aria-hidden="true" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={
                step === 3 || (step === 2 && pageType === "blank") ? handleCreate : handleNext
              }
              disabled={!title.trim() || checkExists.isFetching}
            >
              {checkExists.isFetching ? (
                <span>Checking...</span>
              ) : step === 3 || (step === 2 && pageType === "blank") ? (
                <>
                  <Plus aria-hidden="true" />
                  <span>Create page</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
