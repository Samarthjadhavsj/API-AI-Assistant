import { Header } from "@/components";
import { useApp } from "@/contexts";
import { UseSettingsReturn } from "@/types";
import {
  addCustomAiProvider,
  removeCustomAiProvider,
  updateCustomAiProvider,
  validateCurl,
} from "@/lib";
import { findGeminiModel, GEMINI_RESPONSE_MODELS } from "@/config/gemini-models.constants";
import { GEMINI_AI_PROVIDER_ID } from "@/lib/provider-settings";
import { GeminiResponseSettings } from "@/pages/app/components/gemini/GeminiSettingsSections";
import {
  OtherAiProvidersSection,
  providerName,
  type CustomEndpointActions,
} from "@/pages/app/components/gemini/OtherProviderSections";

/** Which provider answers questions right now, in one line. */
const ActiveProviderSummary = ({
  allAiProviders,
  selectedAIProvider,
}: Pick<UseSettingsReturn, "allAiProviders" | "selectedAIProvider">) => {
  const active = allAiProviders.find((p) => p.id === selectedAIProvider.provider);
  const model = selectedAIProvider.variables?.model?.trim();
  const modelLabel =
    active?.id === GEMINI_AI_PROVIDER_ID
      ? findGeminiModel(GEMINI_RESPONSE_MODELS, model)?.name ?? model
      : model;
  return (
    <p className="text-xs text-muted-foreground" role="status" data-testid="active-ai-provider">
      {active ? (
        <>
          Answering with{" "}
          <span className="font-medium text-foreground">{providerName(active)}</span>
          {modelLabel ? <> · {modelLabel}</> : null}
        </>
      ) : (
        "No provider chosen yet. Set up Gemini or another provider below."
      )}
    </p>
  );
};

/**
 * AI Response providers only (voice is on Voice Transcription): the built-in
 * Gemini integration, then other providers configured by hand, including a
 * custom endpoint. Each keeps its own settings; "Use …" chooses which answers.
 */
export const AIProviders = (settings: UseSettingsReturn) => {
  const {
    allAiProviders,
    selectedAIProvider,
    aiProviderConfigs,
    updateAiProviderConfig,
    removeAiProviderConfig,
    activateAiProvider,
    otherAiProviderId,
    setOtherAiProvider,
  } = settings;
  const { loadData } = useApp();

  // Custom endpoints are stored like before (curl template, response path,
  // streaming), so requests go through them unchanged.
  const customActions: CustomEndpointActions = {
    save: (id, draft) => {
      const errors: Record<string, string> = {};
      if (!draft.curl.trim()) {
        errors.curl = "Add the cURL request for your endpoint.";
      } else {
        const validation = validateCurl(draft.curl, ["TEXT"]);
        if (!validation.isValid) errors.curl = validation.message || "This cURL request isn't valid.";
      }
      if (!draft.responseContentPath.trim()) {
        errors.responseContentPath = "Add where the answer is in the response.";
      }
      if (Object.keys(errors).length > 0) return { errors };

      const definition = {
        name: draft.name.trim(),
        curl: draft.curl.trim(),
        responseContentPath: draft.responseContentPath.trim(),
        streaming: draft.streaming,
      };
      if (id) {
        if (!updateCustomAiProvider(id, definition)) {
          return { errors: { curl: "Couldn't save the endpoint. Please try again." } };
        }
        loadData();
        return { id };
      }
      const created = addCustomAiProvider(definition);
      if (!created?.id) return { errors: { curl: "Couldn't save the endpoint. Please try again." } };
      loadData();
      return { id: created.id };
    },
    remove: (id) => {
      if (removeCustomAiProvider(id)) {
        // Its saved key and fields go with it; other providers keep theirs.
        removeAiProviderConfig(id);
        setOtherAiProvider("");
        loadData();
      }
    },
  };

  return (
    <div id="ai-providers" className="space-y-4">
      <div className="space-y-2">
        <Header
          title="AI Providers"
          description="Choose which AI answers your questions. Gemini is built in; other providers are set up by hand."
          isMainTitle
        />
        <ActiveProviderSummary allAiProviders={allAiProviders} selectedAIProvider={selectedAIProvider} />
      </div>

      <GeminiResponseSettings
        variables={aiProviderConfigs[GEMINI_AI_PROVIDER_ID] ?? {}}
        onChange={(variables) => updateAiProviderConfig(GEMINI_AI_PROVIDER_ID, variables)}
        isActive={selectedAIProvider.provider === GEMINI_AI_PROVIDER_ID}
        onActivate={() => activateAiProvider(GEMINI_AI_PROVIDER_ID)}
      />

      <OtherAiProvidersSection
        allAiProviders={allAiProviders}
        configs={aiProviderConfigs}
        otherProviderId={otherAiProviderId}
        activeProviderId={selectedAIProvider.provider}
        onSelectProvider={setOtherAiProvider}
        onChangeConfig={updateAiProviderConfig}
        onActivate={activateAiProvider}
        customActions={customActions}
      />
    </div>
  );
};
