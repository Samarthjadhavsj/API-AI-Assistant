import { useEffect, useId, useState, type ReactNode } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PencilLineIcon,
  SlidersHorizontalIcon,
  WaypointsIcon,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/components";
import { cn } from "@/lib/utils";
import { extractVariables } from "@/lib/functions/common.function";
import { AI_PROVIDER_NAMES } from "@/config/ai-providers.constants";
import {
  CUSTOM_VOICE_PROVIDER,
  CUSTOM_VOICE_PROVIDER_ID,
  VOICE_PROVIDERS,
  findVoiceProvider,
  type VoiceProviderDefinition,
} from "@/config/voice-providers.constants";
import {
  aiProviderReadiness,
  fieldLabel,
  voiceProviderReadiness,
  type ProviderReadiness,
} from "@/lib/provider-status";
import {
  GEMINI_AI_PROVIDER_ID,
  type AiProviderConfigs,
  type ProviderVariables,
} from "@/lib/provider-settings";
import type { TYPE_PROVIDER } from "@/types";
import { ApiKeyField, ProviderStatus, SettingsSection } from "./GeminiSettingsSections";

/** Value of the "Custom" option in both provider dropdowns. */
export const CUSTOM_OPTION = "__custom__";

/** Host of a URL (or the first URL in a curl command). */
export const endpointHost = (text: string): string => {
  const match = text.match(/https?:\/\/[^\s"'\\]+/);
  if (!match) return "";
  try {
    return new URL(match[0].replace(/\{\{[A-Z_]+\}\}/g, "x")).host;
  } catch {
    return match[0];
  }
};

export const providerName = (provider: TYPE_PROVIDER | undefined): string => {
  if (!provider) return "";
  if (provider.isCustom) return provider.name?.trim() || endpointHost(provider.curl) || "Custom provider";
  return AI_PROVIDER_NAMES[provider.id ?? ""] ?? provider.id ?? "Provider";
};

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

interface ProviderOption {
  value: string;
  name: string;
  /** Muted note on the right, e.g. "No speech-to-text". */
  note?: string;
}

/** Height the full provider list needs (11 compact rows, divider, padding). */
const PROVIDER_LIST_HEIGHT = 340;

/**
 * Before the list opens, make sure there's room for all of it: if neither
 * side of the field has enough, scroll the settings pane so the field sits
 * near the top (room below), or near the bottom when the page ends first.
 */
const makeRoomForList = (trigger: HTMLElement) => {
  const pane = trigger.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
  if (!pane) return;
  const room = () => {
    const r = trigger.getBoundingClientRect();
    return { above: r.top, below: window.innerHeight - r.bottom, top: r.top, bottom: r.bottom };
  };
  let r = room();
  if (Math.max(r.above, r.below) >= PROVIDER_LIST_HEIGHT) return;
  const paneBox = pane.getBoundingClientRect();
  pane.scrollTop += r.top - paneBox.top - 8;
  r = room();
  if (r.below >= PROVIDER_LIST_HEIGHT) return;
  pane.scrollTop += r.bottom - paneBox.bottom + 8;
};

/**
 * Provider dropdown: the providers in order, then Custom below a divider.
 * Every option stays visible in the settings window; type a letter to jump
 * to a provider.
 */
const ProviderSelect = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ProviderOption[];
  value: string;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  const selected = options.find((o) => o.value === value);
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium" htmlFor={id}>
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="h-10 w-full border-1 border-input/50 shadow-none transition-colors focus:border-primary/50"
          onPointerDown={(event) => makeRoomForList(event.currentTarget)}
          onKeyDown={(event) => {
            if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) makeRoomForList(event.currentTarget);
          }}
        >
          <SelectValue placeholder="Choose a provider">
            {value === CUSTOM_OPTION ? (
              <span className="flex items-center gap-2">
                <PencilLineIcon className="size-3.5" />
                Custom
              </span>
            ) : (
              selected?.name
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              textValue={option.name}
              className="h-7 py-0.5 [&>span:last-child]:w-full [&>span:last-child]:min-w-0"
            >
              <span className="flex w-full min-w-0 items-center">
                <span className="truncate font-medium">{option.name}</span>
                {option.note && (
                  <span className="ml-auto shrink-0 pl-3 text-[11px] text-muted-foreground">{option.note}</span>
                )}
              </span>
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem
            value={CUSTOM_OPTION}
            textValue="Custom"
            className="h-7 py-0.5 [&>span:last-child]:w-full [&>span:last-child]:min-w-0"
          >
            <span className="flex w-full min-w-0 items-center gap-2">
              <PencilLineIcon className="size-3.5" />
              <span className="font-medium">Custom</span>
              <span className="ml-auto shrink-0 pl-3 text-[11px] text-muted-foreground">Your own endpoint</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  hint,
  readOnly = false,
  mono = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  readOnly?: boolean;
  mono?: boolean;
}) => {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium" htmlFor={id}>
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn("h-10 text-sm", mono && "font-mono text-xs", readOnly && "bg-muted/40 text-muted-foreground")}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
};

/** "Ready" / "API key required" / "No speech-to-text", announced politely. */
const StatusLine = ({ readiness }: { readiness: ProviderReadiness }) => (
  <p
    role="status"
    data-testid="provider-status"
    className={cn(
      "flex items-center gap-1.5 text-[11px] font-medium",
      readiness.ready ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
    )}
  >
    {readiness.ready ? (
      <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
    ) : (
      <AlertCircleIcon className="size-3.5" aria-hidden="true" />
    )}
    {readiness.status}
  </p>
);

const EndpointLine = ({ host }: { host: string }) =>
  host ? (
    <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
      <WaypointsIcon className="mt-px size-3 shrink-0" aria-hidden="true" />
      <span className="break-all">Requests go to {host}.</span>
    </p>
  ) : null;

// ---------------------------------------------------------------------------
// Other AI providers
// ---------------------------------------------------------------------------

export interface CustomEndpointDraft {
  name: string;
  curl: string;
  responseContentPath: string;
  streaming: boolean;
}

export interface CustomEndpointActions {
  /** Validates and saves a custom endpoint; returns its ID, or errors per field. */
  save: (id: string | null, draft: CustomEndpointDraft) => { id: string } | { errors: Record<string, string> };
  remove: (id: string) => void;
}

const EMPTY_DRAFT: CustomEndpointDraft = { name: "", curl: "", responseContentPath: "", streaming: false };

const draftOf = (provider: TYPE_PROVIDER | undefined): CustomEndpointDraft =>
  provider
    ? {
        name: provider.name ?? "",
        curl: provider.curl,
        responseContentPath: provider.responseContentPath ?? "",
        streaming: !!provider.streaming,
      }
    : EMPTY_DRAFT;

/** Model name, API key and any other variables a provider's request uses. */
const AiProviderFields = ({
  provider,
  variables,
  onChange,
}: {
  provider: TYPE_PROVIDER;
  variables: ProviderVariables;
  onChange: (variables: ProviderVariables) => void;
}) => {
  const keys = extractVariables(provider.curl).map((f) => f.key);
  const set = (key: string, value: string) => onChange({ ...variables, [key]: value });
  const name = providerName(provider);
  return (
    <>
      {keys.includes("model") && (
        <TextField
          label="Model name"
          value={variables.model ?? ""}
          onChange={(value) => set("model", value)}
          placeholder="Model name or ID, as the provider lists it"
        />
      )}
      {keys.includes("api_key") && (
        <ApiKeyField label={`${name} API key`} value={variables.api_key ?? ""} onChange={(value) => set("api_key", value)} />
      )}
      {keys
        .filter((key) => key !== "model" && key !== "api_key")
        .map((key) => (
          <TextField key={key} label={fieldLabel(key)} value={variables[key] ?? ""} onChange={(value) => set(key, value)} />
        ))}
    </>
  );
};

/** Inline editor for a custom endpoint (replaces the old Add Custom Provider card). */
const CustomEndpointEditor = ({
  provider,
  customProviders,
  isInUse,
  onPickEndpoint,
  actions,
  onSaved,
}: {
  provider: TYPE_PROVIDER | undefined;
  customProviders: TYPE_PROVIDER[];
  isInUse: boolean;
  onPickEndpoint: (id: string | null) => void;
  actions: CustomEndpointActions;
  onSaved: (id: string) => void;
}) => {
  const [draft, setDraft] = useState<CustomEndpointDraft>(() => draftOf(provider));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pickerId = useId();
  const curlId = useId();

  // Show the saved endpoint's definition when switching endpoints.
  useEffect(() => {
    setDraft(draftOf(provider));
    setErrors({});
    setConfirmDelete(false);
  }, [provider?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = draftOf(provider);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const set = <K extends keyof CustomEndpointDraft>(key: K, value: CustomEndpointDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    const result = actions.save(provider?.id ?? null, draft);
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSaved(result.id);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-3" role="group" aria-label="Custom endpoint">
      {customProviders.length > 1 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium" htmlFor={pickerId}>
            Saved endpoint
          </Label>
          <Select value={provider?.id ?? "__new__"} onValueChange={(v) => onPickEndpoint(v === "__new__" ? null : v)}>
            <SelectTrigger id={pickerId} className="h-10 w-full border-1 border-input/50 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              {customProviders.map((p) => (
                <SelectItem key={p.id} value={p.id!} className="h-8 py-1">
                  {providerName(p)}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value="__new__" className="h-8 py-1">
                New endpoint
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <TextField
        label="Provider name"
        value={draft.name}
        onChange={(value) => set("name", value)}
        placeholder="e.g. My LLM server"
      />

      <div className="space-y-2">
        <Label className="text-xs font-medium" htmlFor={curlId}>
          Request (cURL)
        </Label>
        <Textarea
          id={curlId}
          value={draft.curl}
          onChange={(event) => set("curl", event.target.value)}
          spellCheck={false}
          rows={5}
          aria-invalid={errors.curl ? true : undefined}
          aria-describedby={`${curlId}-hint`}
          placeholder={`curl https://llm.example.com/v1/chat/completions -H "Authorization: Bearer {{API_KEY}}" -d '{"model": "{{MODEL}}", "messages": [{"role": "user", "content": "{{TEXT}}"}]}'`}
          className="font-mono text-xs"
        />
        <p
          id={`${curlId}-hint`}
          className={cn("text-[11px]", errors.curl ? "text-destructive" : "text-muted-foreground")}
        >
          {errors.curl ??
            "Put {{TEXT}} where your message goes. {{MODEL}}, {{API_KEY}} and any other {{NAME}} become fields below."}
        </p>
      </div>

      <TextField
        label="Response text path"
        value={draft.responseContentPath}
        onChange={(value) => set("responseContentPath", value)}
        placeholder="e.g. choices[0].message.content"
        hint={errors.responseContentPath ?? "Where the answer is in the JSON response."}
        mono
      />

      <label className="flex items-center justify-between gap-3 text-xs font-medium">
        Streaming responses
        <Switch checked={draft.streaming} onCheckedChange={(checked) => set("streaming", checked)} />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={!dirty && !!provider}>
          {provider ? "Save changes" : "Save endpoint"}
        </Button>
        {provider &&
          (confirmDelete ? (
            <>
              <Button type="button" size="sm" variant="destructive" onClick={() => actions.remove(provider.id!)}>
                Delete endpoint
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={isInUse}
              title={isInUse ? "Switch to another provider before deleting this one" : undefined}
            >
              Delete…
            </Button>
          ))}
        {dirty && provider && <span className="text-[11px] text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
};

/**
 * Section 2 of AI Providers: any provider other than Gemini, set up by hand.
 * Each provider keeps its own values; "Use …" makes it answer.
 */
export const OtherAiProvidersSection = ({
  allAiProviders,
  configs,
  otherProviderId,
  activeProviderId,
  onSelectProvider,
  onChangeConfig,
  onActivate,
  customActions,
}: {
  allAiProviders: TYPE_PROVIDER[];
  configs: AiProviderConfigs;
  otherProviderId: string;
  activeProviderId: string;
  onSelectProvider: (id: string) => void;
  onChangeConfig: (id: string, variables: ProviderVariables) => void;
  onActivate: (id: string) => void;
  customActions: CustomEndpointActions;
}) => {
  const builtIn = allAiProviders.filter((p) => !p.isCustom && p.id && p.id !== GEMINI_AI_PROVIDER_ID);
  const customProviders = allAiProviders.filter((p) => p.isCustom && p.id);
  const selectedCustom = customProviders.find((p) => p.id === otherProviderId);
  // "Custom" chosen before any endpoint is saved
  const [newCustom, setNewCustom] = useState(false);
  const customMode = newCustom || !!selectedCustom;

  const provider = customMode ? selectedCustom : builtIn.find((p) => p.id === otherProviderId);
  const selectValue = customMode ? CUSTOM_OPTION : provider?.id ?? "";
  const variables = (provider && configs[provider.id!]) ?? {};
  const name = customMode ? providerName(selectedCustom) || "Custom" : providerName(provider);
  const readiness = provider
    ? aiProviderReadiness(extractVariables(provider.curl).map((f) => f.key), variables)
    : null;

  const choose = (value: string) => {
    if (value === CUSTOM_OPTION) {
      const last = customProviders[customProviders.length - 1];
      if (last) {
        setNewCustom(false);
        onSelectProvider(last.id!);
      } else {
        setNewCustom(true);
      }
      return;
    }
    setNewCustom(false);
    onSelectProvider(value);
  };

  return (
    <SettingsSection
      icon={SlidersHorizontalIcon}
      title="Other AI providers"
      badge="Manual"
      variant="manual"
      description="Set up another provider by hand: its model name and API key, or your own endpoint. Gemini settings aren't affected."
      action={
        provider ? (
          <ProviderStatus
            name={name}
            isActive={activeProviderId === provider.id}
            onActivate={() => onActivate(provider.id!)}
            disabled={!readiness?.ready}
            disabledReason={readiness?.status}
          />
        ) : null
      }
    >
      <ProviderSelect
        label="Provider"
        options={builtIn.map((p) => ({ value: p.id!, name: providerName(p) }))}
        value={selectValue}
        onChange={choose}
      />

      {customMode && (
        <CustomEndpointEditor
          provider={selectedCustom}
          customProviders={customProviders}
          isInUse={!!selectedCustom && activeProviderId === selectedCustom.id}
          onPickEndpoint={(id) => {
            if (id) {
              setNewCustom(false);
              onSelectProvider(id);
            } else {
              setNewCustom(true);
              onSelectProvider("");
            }
          }}
          actions={customActions}
          onSaved={(id) => {
            setNewCustom(false);
            onSelectProvider(id);
          }}
        />
      )}

      {provider ? (
        <div className="space-y-4" role="group" aria-label={`${name} settings`}>
          {!customMode && <TextField label="Provider name" value={name} readOnly />}
          <AiProviderFields
            provider={provider}
            variables={variables}
            onChange={(next) => onChangeConfig(provider.id!, next)}
          />
          <EndpointLine host={endpointHost(provider.curl)} />
          {readiness && <StatusLine readiness={readiness} />}
        </div>
      ) : customMode ? (
        <p className="text-xs text-muted-foreground">Save the endpoint to add its model name and API key.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Choose a provider to set it up.</p>
      )}
    </SettingsSection>
  );
};

// ---------------------------------------------------------------------------
// Other voice providers
// ---------------------------------------------------------------------------

const VOICE_OPTIONS: ProviderOption[] = VOICE_PROVIDERS.map((p) => ({
  value: p.id,
  name: p.name,
  note: p.endpoint ? undefined : "No speech-to-text",
}));

/** Model name, API key and provider-specific fields for a voice provider. */
const VoiceProviderFields = ({
  definition,
  variables,
  onChange,
}: {
  definition: VoiceProviderDefinition;
  variables: ProviderVariables;
  onChange: (variables: ProviderVariables) => void;
}) => {
  const set = (key: string, value: string) => onChange({ ...variables, [key]: value });
  const isCustom = definition.id === CUSTOM_VOICE_PROVIDER_ID;
  const extra = definition.fields;
  return (
    <>
      {isCustom &&
        extra
          .filter((f) => f.key === "endpoint")
          .map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              value={variables[f.key] ?? ""}
              onChange={(value) => set(f.key, value)}
              placeholder={f.placeholder}
              hint={f.hint}
              mono
            />
          ))}
      <TextField
        label="Model name"
        value={variables.model ?? ""}
        onChange={(value) => set("model", value)}
        placeholder={definition.modelPlaceholder ?? "Model name or ID"}
      />
      <ApiKeyField
        label={definition.apiKeyRequired ? `${isCustom ? "" : `${definition.name} `}API key`.trim() : "API key (optional)"}
        value={variables.api_key ?? ""}
        onChange={(value) => set("api_key", value)}
      />
      {extra
        .filter((f) => !isCustom || f.key !== "endpoint")
        .map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={variables[f.key] ?? ""}
            onChange={(value) => set(f.key, value)}
            placeholder={f.placeholder}
            hint={f.hint}
            mono={f.key === "response_path"}
          />
        ))}
    </>
  );
};

/**
 * Section 2 of Voice Transcription: another speech-to-text provider, set up
 * by hand. "Use …" makes voice input transcribe with it. Providers without a
 * speech-to-text API say so and can't be used.
 */
export const OtherVoiceProvidersSection = ({
  configs,
  otherProviderId,
  activeProviderId,
  onSelectProvider,
  onChangeConfig,
  onActivate,
}: {
  configs: AiProviderConfigs;
  otherProviderId: string;
  activeProviderId: string;
  onSelectProvider: (id: string) => void;
  onChangeConfig: (id: string, variables: ProviderVariables) => void;
  onActivate: (id: string) => void;
}) => {
  const definition = findVoiceProvider(otherProviderId);
  const isCustom = definition?.id === CUSTOM_VOICE_PROVIDER_ID;
  const variables = (definition && configs[definition.id]) ?? {};
  const name = isCustom ? variables.name?.trim() || "Custom" : definition?.name ?? "";
  const readiness = definition ? voiceProviderReadiness(definition.id, variables) : null;
  const set = (key: string, value: string) =>
    definition && onChangeConfig(definition.id, { ...variables, [key]: value });

  let body: ReactNode;
  if (!definition) {
    body = <p className="text-xs text-muted-foreground">Choose a provider to set it up.</p>;
  } else if (readiness?.unsupported) {
    body = (
      <div className="space-y-3" role="group" aria-label={`${name} settings`}>
        <TextField label="Provider name" value={name} readOnly />
        <p role="note" className="flex items-start gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <AlertCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {definition.unsupportedReason} Choose another provider for voice input.
        </p>
        <StatusLine readiness={readiness} />
      </div>
    );
  } else {
    body = (
      <div className="space-y-4" role="group" aria-label={`${name} settings`}>
        {isCustom ? (
          <TextField
            label="Provider name"
            value={variables.name ?? ""}
            onChange={(value) => set("name", value)}
            placeholder="e.g. My Whisper server"
          />
        ) : (
          <TextField label="Provider name" value={name} readOnly />
        )}
        <VoiceProviderFields
          definition={isCustom ? CUSTOM_VOICE_PROVIDER : definition}
          variables={variables}
          onChange={(next) => onChangeConfig(definition.id, next)}
        />
        <EndpointLine host={endpointHost(isCustom ? variables.endpoint ?? "" : definition.endpoint ?? "")} />
        {readiness && <StatusLine readiness={readiness} />}
      </div>
    );
  }

  return (
    <SettingsSection
      icon={SlidersHorizontalIcon}
      title="Other voice providers"
      badge="Manual"
      variant="manual"
      description="Transcribe with another speech-to-text service instead of Gemini Voice. Gemini Voice settings aren't affected."
      action={
        definition && !readiness?.unsupported ? (
          <ProviderStatus
            name={name}
            isActive={activeProviderId === definition.id}
            onActivate={() => onActivate(definition.id)}
            disabled={!readiness?.ready}
            disabledReason={readiness?.status}
          />
        ) : null
      }
    >
      <ProviderSelect
        label="Provider"
        options={VOICE_OPTIONS}
        value={isCustom ? CUSTOM_OPTION : definition?.id ?? ""}
        onChange={(value) => onSelectProvider(value === CUSTOM_OPTION ? CUSTOM_VOICE_PROVIDER_ID : value)}
      />
      {body}
    </SettingsSection>
  );
};
