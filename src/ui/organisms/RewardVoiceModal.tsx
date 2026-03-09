import { useEffect, useState, type CSSProperties } from "react";
import {
  loadRewardVoiceConfig,
  saveRewardVoiceConfig,
  getDefaultRewardVoiceConfig,
  MODEL_OPTIONS,
  type RewardVoiceConfig
} from "../../rewardVoiceConfig";
import { speakWithElevenLabsFromText, fetchElevenVoices } from "../../elevenLabsApi";
import { Button } from "../atoms/Button";
import { ModalHeader } from "../molecules/ModalHeader";
import { useToast } from "../context/ToastContext";

type Props = {
  rewardId: string;
  rewardTitle: string;
  onClose: () => void;
};

export const RewardVoiceModal = ({ rewardId, rewardTitle, onClose }: Props) => {
  const { addToast } = useToast();
  const [voiceId, setVoiceId] = useState("");
  const [voices, setVoices] = useState<{ voice_id: string; name: string }[]>([]);
  const [modelId, setModelId] = useState("eleven_turbo_v2_5");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [testText, setTestText] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  useEffect(() => {
    const existing = loadRewardVoiceConfig(rewardId);
    if (existing) {
      setVoiceId(existing.voiceId);
      setModelId(existing.modelId);
      setStability(existing.stability);
      setSimilarityBoost(existing.similarityBoost);
      setStyle(existing.style);
      setSpeed(existing.speed);
    } else {
      const def = getDefaultRewardVoiceConfig();
      setVoiceId(def.voiceId);
      setModelId(def.modelId);
      setStability(def.stability);
      setSimilarityBoost(def.similarityBoost);
      setStyle(def.style);
      setSpeed(def.speed);
    }

    void (async () => {
      const list = await fetchElevenVoices();
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, "fr-FR"));
      setVoices(sorted);
    })();
  }, [rewardId]);

  const getConfig = (): RewardVoiceConfig => ({
    voiceId: voiceId.trim(),
    modelId,
    stability,
    similarityBoost,
    style,
    speed
  });

  const handleSave = async () => {
    const cfg = getConfig();

    if (!cfg.voiceId) {
      saveRewardVoiceConfig(rewardId, cfg);
      addToast("Enregistré");
      onClose();
      return;
    }

    const result = await speakWithElevenLabsFromText("Enregistré !", cfg);
    if (!result.ok && result.status === 402) {
      addToast(
        <>
          Erreur ElevenLabs. Vérifie que cette voix est bien disponible dans{" "}
          <a
            href="https://elevenlabs.io/app/voice-lab"
            target="_blank"
            rel="noreferrer"
          >
            « Mes Voix » sur ElevenLabs
          </a>
          .
        </>,
        "danger",
        8000
      );
      return;
    }

    saveRewardVoiceConfig(rewardId, cfg);
    addToast("Enregistré");
    onClose();
  };

  const handleTest = async () => {
    const cfg = getConfig();
    if (!cfg.voiceId) return;
    const result = await speakWithElevenLabsFromText(
      testText.trim() || "Test de la voix.",
      cfg
    );
    if (!result.ok && result.status === 402) {
      addToast(
        <>
          Erreur ElevenLabs. Vérifie que cette voix est bien disponible dans{" "}
          <a
            href="https://elevenlabs.io/app/voice-lab"
            target="_blank"
            rel="noreferrer"
          >
            « Mes Voix » sur ElevenLabs
          </a>
          .
        </>,
        "danger",
        8000
      );
    }
  };

  const getRangeStyle = (value: number, min: number, max: number): CSSProperties =>
    ({
      "--range-fill": `${((value - min) / (max - min)) * 100}%`
    } as CSSProperties);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-voice-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="panel modal-content settings-modal-content reward-voice-modal"
        onClick={(e) => {
          e.stopPropagation();
          setVoiceOpen(false);
          setModelOpen(false);
        }}
      >
        <ModalHeader
          titleId="reward-voice-modal-title"
          title={`Voix TTS • ${rewardTitle}`}
          onClose={onClose}
          closeVariant="twitch"
        />

        <div className="reward-voice-modal-body">
          <div className="reward-voice-modal-fields">
            <div className="reward-voice-dropdown-wrap reward-voice-field-first">
              <label htmlFor="rv-voice-id" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
                Voix ElevenLabs
              </label>
              {voices.length > 0 ? (
                <>
                  <button
                    id="rv-voice-id"
                    type="button"
                    className="field reward-voice-dropdown-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVoiceOpen((v) => !v);
                      setModelOpen(false);
                    }}
                    aria-expanded={voiceOpen}
                    aria-haspopup="listbox"
                    aria-label="Choisir une voix"
                  >
                    {voices.find((v) => v.voice_id === voiceId)?.name ?? "Choisir une voix…"}
                  </button>
                  {voiceOpen && (
                    <ul
                      className="reward-voice-dropdown-list"
                      role="listbox"
                      aria-labelledby="rv-voice-id"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <li
                        role="option"
                        aria-selected={!voiceId}
                        className="reward-voice-dropdown-option"
                        onClick={() => {
                          setVoiceId("");
                          setVoiceOpen(false);
                        }}
                      >
                        Choisir une voix…
                      </li>
                      {voices.map((v) => (
                        <li
                          key={v.voice_id}
                          role="option"
                          aria-selected={voiceId === v.voice_id}
                          className="reward-voice-dropdown-option"
                          onClick={() => {
                            setVoiceId(v.voice_id);
                            setVoiceOpen(false);
                          }}
                        >
                          {v.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <input
                  id="rv-voice-id"
                  type="text"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  placeholder="Choisir une voix…"
                  className="field"
                />
              )}
            </div>

            <div className="reward-voice-dropdown-wrap">
              <label htmlFor="rv-model" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
                Modèle
              </label>
              <button
                id="rv-model"
                type="button"
                className="field reward-voice-dropdown-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setModelOpen((v) => !v);
                  setVoiceOpen(false);
                }}
                aria-expanded={modelOpen}
                aria-haspopup="listbox"
                aria-label="Choisir un modèle"
              >
                {MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? modelId}
              </button>
              {modelOpen && (
                <ul
                  className="reward-voice-dropdown-list"
                  role="listbox"
                  aria-labelledby="rv-model"
                  onClick={(e) => e.stopPropagation()}
                >
                  {MODEL_OPTIONS.map((m) => (
                    <li
                      key={m.id}
                      role="option"
                      aria-selected={modelId === m.id}
                      className="reward-voice-dropdown-option"
                      onClick={() => {
                        setModelId(m.id);
                        setModelOpen(false);
                      }}
                    >
                      {m.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="reward-voice-range-grid">
              <div className="reward-voice-range-item">
                <label htmlFor="rv-speed" className="reward-voice-range-label">
                  Vitesse ({speed.toFixed(2)})
                </label>
                <input
                  id="rv-speed"
                  type="range"
                  min={0.7}
                  max={1.2}
                  step={0.01}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="reward-voice-range"
                  style={getRangeStyle(speed, 0.7, 1.2)}
                />
              </div>
              <div className="reward-voice-range-item">
                <label htmlFor="rv-stability" className="reward-voice-range-label">
                  Stabilité ({(stability * 100).toFixed(0)}%)
                </label>
                <input
                  id="rv-stability"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={stability}
                  onChange={(e) => setStability(parseFloat(e.target.value))}
                  className="reward-voice-range"
                  style={getRangeStyle(stability, 0, 1)}
                />
              </div>
              <div className="reward-voice-range-item">
                <label htmlFor="rv-similarity" className="reward-voice-range-label">
                  Similarité ({(similarityBoost * 100).toFixed(0)}%)
                </label>
                <input
                  id="rv-similarity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={similarityBoost}
                  onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                  className="reward-voice-range"
                  style={getRangeStyle(similarityBoost, 0, 1)}
                />
              </div>
              <div className="reward-voice-range-item">
                <label htmlFor="rv-style" className="reward-voice-range-label">
                  Style ({(style * 100).toFixed(0)}%)
                </label>
                <input
                  id="rv-style"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={style}
                  onChange={(e) => setStyle(parseFloat(e.target.value))}
                  className="reward-voice-range"
                  style={getRangeStyle(style, 0, 1)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="rv-test" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
                Texte de test
              </label>
              <input
                id="rv-test"
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Saisis un texte pour tester…"
                className="field reward-voice-input"
              />
              <Button
                variant="primary"
                style={{ marginTop: "0.75rem" }}
                onClick={handleTest}
                disabled={!voiceId.trim()}
              >
                Tester la voix
              </Button>
            </div>
          </div>
        </div>

        <div className="reward-voice-modal-footer">
          <Button variant="primary" onClick={handleSave}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
};
