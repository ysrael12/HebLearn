use std::collections::HashSet;

/// Range de marcas de vogal/cantilação do hebraico (U+0591–U+05C7).
fn is_niqqud(c: char) -> bool {
    ('\u{0591}'..='\u{05C7}').contains(&c)
}

fn is_hebrew_letter(c: char) -> bool {
    ('\u{05D0}'..='\u{05EA}').contains(&c)
}

/// Remove marcas de vogal do texto (para comparação/lookup).
pub fn strip_niqqud(text: &str) -> String {
    text.chars().filter(|&c| !is_niqqud(c)).collect()
}

const STOPWORDS: &[&str] = &[
    "אולם", "או", "אולי", "אותך", "אותם", "אותן", "אותו", "אותי", "אז", "אחר",
    "אחרי", "אחרת", "אחת", "אינו", "אין", "איפה", "אלא", "אנו", "אני", "אתם",
    "את", "באמת", "בין", "בלי", "בני", "בשביל", "בתוך", "גם", "די", "הוא",
    "היא", "הם", "הן", "הזה", "הזו", "זה", "זאת", "זו", "חוץ", "חצי", "כל",
    "כלום", "כמה", "כמו", "כן", "לא", "לפני", "מאוד", "מאד", "מה", "מי",
    "ממש", "עוד", "עכשיו", "על", "עליו", "עליה", "עליהם", "פחות", "פה",
    "רק", "של", "שלי", "שלך", "שלנו", "שלהם", "שם", "תוך", "כדי", "כאשר",
    "אם", "שלא", "שלום", "בלי", "אצל", "אל", "אלה", "אלו", "אחת", "אחרות",
    "אותה", "אותו", "הלא", "הרי", "מאוד", "אף", "כבר", "יחד", "אזי",
];

fn is_stopword(word: &str) -> bool {
    STOPWORDS.iter().any(|s| *s == word)
}

/// Prefixos preposicionais mais comuns do hebraico (conectores).
const PREFIXES: &[char] = &['ו', 'ב', 'ה', 'ל', 'כ'];

/// Remove prefixos conectores (ו/ב/ה/ל/כ) do início da palavra,
/// desde que sobrem pelo menos 3 letras (evita corromper "מים"→"ים").
/// Retorna (palavra limpa, quantidade de letras removidas).
fn strip_prefixes(word: &str) -> (String, usize) {
    let chars: Vec<char> = word.chars().collect();
    let mut start = 0;
    while start + 3 <= chars.len() && PREFIXES.contains(&chars[start]) {
        start += 1;
    }
    (chars[start..].iter().collect(), start)
}

/// Remove `count` letras iniciais (e o niqqud anexado a cada uma) de um texto
/// pontuado, preservando a forma com vogais da palavra restante.
/// Ex.: strip_prefix_letters("הַתִּיכוֹן", 1) → "תִּיכוֹן".
fn strip_prefix_letters(dotted: &str, count: usize) -> String {
    let mut removed = 0;
    let mut out = String::new();
    let mut iter = dotted.chars().peekable();
    while removed < count {
        match iter.next() {
            Some(c) if is_hebrew_letter(c) => {
                while let Some(&n) = iter.peek() {
                    if is_niqqud(n) {
                        iter.next();
                    } else {
                        break;
                    }
                }
                removed += 1;
            }
            Some(c) => out.push(c),
            None => break,
        }
    }
    out.extend(iter);
    out
}

/// Extrai palavras-chave do texto (já com nikud ou sem).
/// Retorna pares (palavra sem vogais/prefixos, forma pontuada para exibição).
/// Remove stopwords, pontuação e duplicados, preservando a ordem.
pub fn extract_keywords(text: &str) -> Vec<(String, String)> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut out: Vec<(String, String)> = Vec::new();

    for token in text.split_whitespace() {
        let dotted = token.to_string();
        let plain = strip_niqqud(token);
        if plain.is_empty() {
            continue;
        }
        // Aceita apenas letras hebraicas (ignora pontuação/maqaf).
        if !plain.chars().all(is_hebrew_letter) {
            continue;
        }
        if plain.chars().count() < 2 {
            continue;
        }
        let (stripped, stripped_count) = strip_prefixes(&plain);
        if stripped.chars().count() < 2 || is_stopword(&stripped) {
            continue;
        }
        if seen.contains(&stripped) {
            continue;
        }
        seen.insert(stripped.clone());
        // Mantém a forma pontuada; se houver prefixo removido, remove as mesmas
        // letras do texto pontuado para preservar o nikud da raiz.
        let display = if stripped_count == 0 {
            dotted
        } else {
            let d = strip_prefix_letters(&dotted, stripped_count);
            if d.is_empty() {
                stripped.clone()
            } else {
                d
            }
        };
        out.push((stripped, display));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserva_nikud_sem_prefixo() {
        let out = extract_keywords("יְרוּשָׁלַיִם הִיא בִּירַת יִשְׂרָאֵל");
        assert!(out.contains(&("ירושלים".to_string(), "יְרוּשָׁלַיִם".to_string())));
        assert!(out.contains(&("ישראל".to_string(), "יִשְׂרָאֵל".to_string())));
    }

    #[test]
    fn remove_prefixo_mantendo_nikud_da_raiz() {
        let out = extract_keywords("הַתִּיכוֹן וּבְמִצְרַיִם");
        assert!(out.contains(&("תיכון".to_string(), "תִּיכוֹן".to_string())));
        assert!(out.contains(&("מצרים".to_string(), "מִצְרַיִם".to_string())));
    }

    #[test]
    fn remove_stopwords() {
        let out = extract_keywords("שָׁלוֹם לְךָ, יְרוּשָׁלַיִם");
        assert!(!out.iter().any(|(w, _)| w == "שלום"));
        assert!(out.iter().any(|(w, _)| w == "ירושלים"));
    }
}
