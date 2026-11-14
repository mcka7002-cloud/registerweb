"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, errorKey } from "@/lib/utils";
import { submitRegistration } from "../actions";
import type { BranchOption } from "../queries";
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES, photoType, type RegisterResult, type RegistrationField } from "../schema";

const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

type Invalid = ReadonlySet<RegistrationField>;

function FieldError({ name, invalid }: { name: RegistrationField; invalid: Invalid }) {
  const t = useTranslations("register");
  if (!invalid.has(name)) return null;
  return <p className="text-sm text-destructive">{t(`fieldErrors.${name}`)}</p>;
}

function TextField({
  name,
  label,
  invalid,
  type = "text",
  required = false,
  ...rest
}: {
  name: RegistrationField;
  label: string;
  invalid: Invalid;
  type?: string;
  required?: boolean;
} & Omit<React.ComponentProps<"input">, "name">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`reg-${name}`}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Input
        id={`reg-${name}`}
        name={name}
        type={type}
        required={required}
        aria-invalid={invalid.has(name) || undefined}
        {...rest}
      />
      <FieldError name={name} invalid={invalid} />
    </div>
  );
}

/** Optional student photo with a local preview. The server checks type and size again. */
function PhotoField({
  invalid,
  uploadFailed,
  resetKey,
}: {
  invalid: Invalid;
  uploadFailed: boolean;
  resetKey: number;
}) {
  const t = useTranslations("register");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [fileName, setFileName] = useState("");
  const [localError, setLocalError] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // The parent resets the form after a successful submit.
  useEffect(() => {
    setPreview(null);
    setFileName("");
    setLocalError(false);
  }, [resetKey]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    setPreviewFailed(false);
    if (!file) {
      setPreview(null);
      setFileName("");
      setLocalError(false);
      return;
    }
    if (!photoType(file) || file.size > PHOTO_MAX_BYTES) {
      e.currentTarget.value = "";
      setPreview(null);
      setFileName("");
      setLocalError(true);
      return;
    }
    setLocalError(false);
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setFileName("");
    setLocalError(false);
  }

  const showError = localError || invalid.has("photo");
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Label htmlFor="reg-photo">{t("fields.photo")}</Label>
      <div className="flex items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
          {preview && !previewFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt={t("photo.previewAlt")} className="size-full object-cover" onError={() => setPreviewFailed(true)} />
          ) : (
            <ImageIcon className="size-8" aria-hidden />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Input
            ref={inputRef}
            id="reg-photo"
            name="photo"
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={onChange}
            aria-invalid={showError || undefined}
            aria-describedby="reg-photo-hint"
          />
          <p id="reg-photo-hint" className="text-xs text-muted-foreground">
            {previewFailed && fileName ? t("photo.noPreview", { name: fileName }) : t("photo.hint")}
          </p>
          {fileName ? (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={clear}>
              {t("photo.remove")}
            </Button>
          ) : null}
        </div>
      </div>
      {showError ? (
        <p className="text-sm text-destructive">
          {uploadFailed && !localError ? t("photo.uploadFailed") : t("fieldErrors.photo")}
        </p>
      ) : null}
    </div>
  );
}

export function RegistrationForm({ branches }: { branches: BranchOption[] }) {
  const t = useTranslations("register");
  const tRoot = useTranslations();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState<RegisterResult | null, FormData>(submitRegistration, null);
  const defaultBranch = branches.length === 1 ? branches[0].id : "";
  const [branchId, setBranchId] = useState(defaultBranch);
  const [gender, setGender] = useState("");
  const [resetKey, setResetKey] = useState(0);

  const invalid = new Set<RegistrationField>(state && !state.ok && state.fields ? state.fields : []);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(t("success"));
      formRef.current?.reset();
      setBranchId(defaultBranch);
      setGender("");
      setResetKey((k) => k + 1);
    } else if (state.code === "INVALID_INPUT") {
      toast.error(t("invalid"));
    } else if (state.code === "UPLOAD_FAILED") {
      toast.error(t("photo.uploadFailed"));
    } else {
      toast.error(tRoot(errorKey(state.code)));
    }
  }, [state, t, tRoot, defaultBranch]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Dispatch manually so React does not reset the form when validation fails.
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t("sections.branch")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          <Label htmlFor="reg-branch_id">
            {t("fields.branch")}
            <span className="text-destructive">*</span>
          </Label>
          <Select name="branch_id" value={branchId} onValueChange={setBranchId}>
            <SelectTrigger id="reg-branch_id" className="w-full sm:w-80" aria-invalid={invalid.has("branch_id") || undefined}>
              <SelectValue placeholder={t("fields.branchPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError name="branch_id" invalid={invalid} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.student")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField invalid={invalid} name="first_name" label={t("fields.firstName")} required autoComplete="off" />
          <TextField invalid={invalid} name="last_name" label={t("fields.lastName")} required autoComplete="off" />
          <TextField invalid={invalid} name="first_name_en" label={t("fields.firstNameEn")} required autoComplete="off" lang="en" />
          <TextField invalid={invalid} name="last_name_en" label={t("fields.lastNameEn")} required autoComplete="off" lang="en" />
          <TextField invalid={invalid} name="nickname" label={t("fields.nickname")} autoComplete="off" />
          <TextField invalid={invalid} name="birth_date" label={t("fields.birthDate")} type="date" required />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-gender">{t("fields.gender")}</Label>
            <Select name="gender" value={gender} onValueChange={setGender}>
              <SelectTrigger id="reg-gender" className="w-full">
                <SelectValue placeholder={t("fields.genderPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("gender.male")}</SelectItem>
                <SelectItem value="female">{t("gender.female")}</SelectItem>
              </SelectContent>
            </Select>
            <FieldError name="gender" invalid={invalid} />
          </div>
          <TextField invalid={invalid} name="height_cm" label={t("fields.heightCm")} type="number" inputMode="decimal" min={50} max={250} step="0.1" />
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="reg-medical_notes">{t("fields.medicalNotes")}</Label>
            <textarea
              id="reg-medical_notes"
              name="medical_notes"
              maxLength={1000}
              className={textareaClass}
              aria-invalid={invalid.has("medical_notes") || undefined}
            />
            <FieldError name="medical_notes" invalid={invalid} />
          </div>
          <PhotoField invalid={invalid} uploadFailed={state?.ok === false && state.code === "UPLOAD_FAILED"} resetKey={resetKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.guardian")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField invalid={invalid} name="guardian_name" label={t("fields.guardianName")} required autoComplete="name" />
          <TextField invalid={invalid} name="relation" label={t("fields.relation")} required placeholder={t("fields.relationPlaceholder")} />
          <TextField invalid={invalid} name="phone1" label={t("fields.phone1")} type="tel" required inputMode="tel" autoComplete="tel" />
          <TextField invalid={invalid} name="phone2" label={t("fields.phone2")} type="tel" inputMode="tel" />
          <TextField invalid={invalid} name="phone3" label={t("fields.phone3")} type="tel" inputMode="tel" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.consent")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                name="pdpa_consent"
                required
                className={cn("mt-1 size-5 shrink-0 accent-primary", invalid.has("pdpa_consent") && "outline outline-destructive")}
              />
              <span>
                {t("fields.pdpa")}
                <span className="text-destructive">*</span>
              </span>
            </label>
            <FieldError name="pdpa_consent" invalid={invalid} />
          </div>
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" name="publish_consent" className="mt-1 size-5 shrink-0 accent-primary" />
            <span>{t("fields.publish")}</span>
          </label>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
