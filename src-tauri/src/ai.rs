use base64::Engine;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout};
use tokio::time::{timeout, Duration};

const AI_TIMEOUT_SECS: u64 = 60;

/// Daemon persistente: um único processo Python embutido que mantém o modelo
/// nakdimon (nikud) e a voz piper (TTS) carregados em memória, atendendo
/// vários parágrafos sem recarregar os modelos.
///
/// Protocolo: linhas JSON ASCII, com payloads base64.
///   request:  {"op": "nikud"|"tts", "text": "<b64 utf-8>"}
///   response: {"ok": true, "data": "<b64 utf-8 bytes>"}
///             {"ok": false, "error": "<b64 utf-8>"}
pub struct AiDaemon {
    _child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl AiDaemon {
    pub async fn spawn(python: &str, script: &str, tts_model: &str) -> Result<Self, String> {
        let mut child = tokio::process::Command::new(python)
            .arg("-u")
            .arg(script)
            .arg(tts_model)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Não foi possível executar o serviço de IA: {e}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Falha ao abrir stdin do serviço de IA.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Falha ao abrir stdout do serviço de IA.".to_string())?;
        let stdout = BufReader::new(stdout);

        let mut daemon = Self {
            _child: child,
            stdin,
            stdout,
        };
        daemon.ready().await?;
        Ok(daemon)
    }

    async fn ready(&mut self) -> Result<(), String> {
        self.stdin
            .write_all(b"PING\n")
            .await
            .map_err(|e| format!("Falha ao enviar ao serviço de IA: {e}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| format!("Falha ao enviar ao serviço de IA: {e}"))?;
        let mut line = String::new();
        timeout(
            Duration::from_secs(AI_TIMEOUT_SECS),
            self.stdout.read_line(&mut line),
        )
        .await
        .map_err(|_| "Tempo esgotado na inicialização do serviço de IA.".to_string())?
        .map_err(|e| format!("Falha ao ler do serviço de IA: {e}"))?;
        if line.trim() != "PONG" {
            return Err("Serviço de IA não respondeu ao teste de inicialização.".to_string());
        }
        Ok(())
    }

    /// Envia uma operação e devolve os bytes de resposta (nikud utf-8 ou WAV).
    /// `timeout_secs` é específico por operação (TTS é mais demorado que nikud).
    async fn request(
        &mut self,
        op: &str,
        text: &str,
        timeout_secs: u64,
    ) -> Result<Vec<u8>, String> {
        let req = serde_json::json!({
            "op": op,
            "text": base64::engine::general_purpose::STANDARD.encode(text.as_bytes()),
        })
        .to_string();
        self.stdin
            .write_all(req.as_bytes())
            .await
            .map_err(|e| format!("Falha ao enviar ao serviço de IA: {e}"))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|e| format!("Falha ao enviar ao serviço de IA: {e}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| format!("Falha ao enviar ao serviço de IA: {e}"))?;

        let mut line = String::new();
        let n = timeout(
            Duration::from_secs(timeout_secs),
            self.stdout.read_line(&mut line),
        )
        .await
        .map_err(|_| "Tempo esgotado ao processar o texto.".to_string())?
        .map_err(|e| format!("Falha ao ler do serviço de IA: {e}"))?;
        if n == 0 {
            return Err("Serviço de IA encerrou inesperadamente.".to_string());
        }

        let resp: serde_json::Value = serde_json::from_str(&line)
            .map_err(|_| "Resposta inválida do serviço de IA.".to_string())?;
        if resp["ok"].as_bool().unwrap_or(false) {
            let data = resp["data"]
                .as_str()
                .ok_or_else(|| "Resposta inválida do serviço de IA.".to_string())?;
            base64::engine::general_purpose::STANDARD
                .decode(data.as_bytes())
                .map_err(|_| "Resposta inválida do serviço de IA.".to_string())
        } else {
            let err = resp["error"]
                .as_str()
                .ok_or_else(|| "Resposta inválida do serviço de IA.".to_string())?;
            let msg = base64::engine::general_purpose::STANDARD
                .decode(err.as_bytes())
                .ok()
                .and_then(|b| String::from_utf8(b).ok())
                .unwrap_or_else(|| "Erro desconhecido do serviço de IA.".to_string());
            Err(msg)
        }
    }

    /// Aplica nikud ao texto (retorna texto com vogais em UTF-8).
    pub async fn add_nikud(&mut self, text: &str) -> Result<String, String> {
        let bytes = self.request("nikud", text, 60).await?;
        String::from_utf8(bytes).map_err(|_| "Saída inválida do serviço de nikud.".to_string())
    }

    /// Sintetiza áudio (retorna WAV). Parágrafos longos podem levar minutos.
    pub async fn synthesize(&mut self, text: &str) -> Result<Vec<u8>, String> {
        self.request("tts", text, 300).await
    }
}

/// Hash SHA-256 do texto (chave do `audio_cache`).
pub fn text_hash(text: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(text.as_bytes());
    digest.iter().map(|b| format!("{:02x}", b)).collect()
}
