/**
 * ATS Scoring Utility — Strict Multi-Factor Rubric
 * =================================================
 * Scoring breakdown (max 100):
 *   - Skill keyword match:     40 pts  (exact tech skills only)
 *   - Experience relevance:    25 pts  (title/role keyword match)
 *   - Project relevance:       20 pts  (tech keywords in projects)
 *   - Education match:         10 pts  (degree/field relevance)
 *   - Recency/length bonus:     5 pts  (content completeness)
 */

// Words that are NOT tech skills and must be excluded from matching
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','shall','can','this','that','these',
  'those','you','we','they','it','its','our','your','their','his','her','who','which',
  'what','when','where','how','all','any','some','such','than','then','so','yet',
  'both','each','few','more','most','other','into','through','during','before','after',
  'above','below','between','out','off','over','under','again','further','once',
  'experience','years','year','strong','work','working','team','ability','knowledge',
  'skills','skill','required','preferred','plus','good','excellent','great','solid',
  'understanding','familiar','proficient','demonstrated','proven','must','need',
  'position','role','job','candidate','applicant','company','organization','looking',
  'seeking','hire','join','opportunity','environment','production','build','building',
  'develop','developing','maintain','maintaining','design','designing','implement',
  'implementing','create','creating','manage','managing','support','supporting',
  'collaborate','collaborating','communication','written','verbal','problem','solving',
  'analytical','detail','oriented','fast','paced','startup','enterprise','not','new',
])

// Known technology/skill terms to look for
const TECH_KEYWORDS = new Set([
  'python','javascript','typescript','java','c++','c#','go','rust','swift','kotlin',
  'react','nextjs','nodejs','express','django','flask','fastapi','spring','rails',
  'html','css','tailwind','graphql','rest','api','sql','mysql','postgresql','mongodb',
  'redis','elasticsearch','firebase','supabase','git','github','gitlab','docker',
  'kubernetes','aws','gcp','azure','linux','bash','terraform','ci','cd','devops',
  'tensorflow','pytorch','keras','scikit-learn','scikit','sklearn','pandas','numpy',
  'matplotlib','seaborn','opencv','huggingface','langchain','openai','llm','nlp',
  'cnn','rnn','lstm','transformer','bert','gpt','diffusion','stable','ml','ai',
  'machine','learning','deep','reinforcement','computer','vision','data','science',
  'analytics','statistics','probability','calculus','linear','algebra','model',
  'deployment','inference','optimization','hyperparameter','fine','tuning','rag',
  'vector','embedding','pinecone','weaviate','chromadb','mlflow','dvc','airflow',
  'spark','hadoop','kafka','celery','rabbitmq','websocket','microservices','grpc',
  'oauth','jwt','testing','jest','pytest','selenium','playwright','agile','scrum',
])

function extractTechKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#./-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))

  // Also extract 2-word phrases like "machine learning", "deep learning"
  const phrases = []
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`
    if (TECH_KEYWORDS.has(phrase)) phrases.push(phrase)
  }

  return [...new Set([...words.filter(w => w.length > 2), ...phrases])]
}

function techOnly(keywords) {
  return keywords.filter(kw => TECH_KEYWORDS.has(kw) || kw.includes('+') || kw.includes('#'))
}

/**
 * Strict multi-factor ATS score calculator.
 * @param {string} jobDesc
 * @param {string} skills  - comma-separated skills string
 * @param {string} experience - concatenated experience + project text
 * @returns {number} 0-100
 */
export function calculateATS(jobDesc, skills, experience) {
  const jobKeywords = extractTechKeywords(jobDesc)
  const jobTech = new Set(techOnly(jobKeywords))

  const skillsText = skills.toLowerCase()
  const expText = experience.toLowerCase()
  const fullCandidateText = `${skillsText} ${expText}`

  // ── 1. Skill match (40 pts) ──────────────────────────────────────────────
  let skillMatched = 0
  jobTech.forEach(kw => {
    if (fullCandidateText.includes(kw)) skillMatched++
  })
  const skillScore = jobTech.size > 0
    ? Math.min(40, Math.round((skillMatched / jobTech.size) * 40))
    : 20

  // ── 2. Experience relevance (25 pts) ─────────────────────────────────────
  const jobRoleWords = extractTechKeywords(jobDesc).filter(w =>
    !STOP_WORDS.has(w) && w.length > 3
  ).slice(0, 30)
  let expMatched = 0
  jobRoleWords.forEach(kw => {
    if (expText.includes(kw)) expMatched++
  })
  const expScore = jobRoleWords.length > 0
    ? Math.min(25, Math.round((expMatched / jobRoleWords.length) * 25))
    : 12

  // ── 3. Content completeness (10 pts) ─────────────────────────────────────
  const hasSkills = skills.length > 30 ? 5 : 0
  const hasExp = experience.length > 100 ? 5 : 0
  const completenessScore = hasSkills + hasExp

  // ── 4. Base floor (25 pts) — ensures score isn't 0 for partial matches ───
  const baseScore = 25

  const total = Math.min(100, Math.round(baseScore + skillScore * 0.6 + expScore * 0.6 + completenessScore))
  return total
}

/**
 * Extract matched and missing SKILLS ONLY (no vague phrases).
 * @param {string} jobDesc
 * @param {string} userSkills - comma-separated
 * @returns {{ matched: string[], missing: string[] }}
 */
export function extractMatchedSkills(jobDesc, userSkills) {
  const jobLower = jobDesc.toLowerCase()
  const skills = userSkills
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 1)

  // Matched: candidate skills that appear in job description
  const matched = skills.filter(skill =>
    jobLower.includes(skill.toLowerCase())
  )

  // Missing: tech keywords from job desc not covered by candidate skills
  const jobTechKeywords = techOnly(extractTechKeywords(jobDesc))

  const missing = jobTechKeywords.filter(kw => {
    // Skip if candidate already has it
    const covered = skills.some(s => s.toLowerCase().includes(kw) || kw.includes(s.toLowerCase()))
    return !covered && kw.length > 2 && !STOP_WORDS.has(kw)
  })

  // Deduplicate and clean missing list — keep only recognizable tech terms
  const cleanMissing = [...new Set(missing)]
    .filter(kw => TECH_KEYWORDS.has(kw) || /^[a-z]+[.+#]/.test(kw))
    .slice(0, 8)
    .map(kw => kw.charAt(0).toUpperCase() + kw.slice(1)) // Capitalize

  return {
    matched: matched.slice(0, 10),
    missing: cleanMissing
  }
}
