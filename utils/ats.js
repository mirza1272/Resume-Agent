const COMMON_STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these', 'those', 'you', 'we', 'they', 'it', 'its', 'our', 'your'])

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !COMMON_STOP_WORDS.has(w))
}

export function calculateATS(jobDesc, skills, experience) {
  const jobKeywords = new Set(extractKeywords(jobDesc))
  const candidateText = `${skills} ${experience}`.toLowerCase()
  const candidateKeywords = new Set(extractKeywords(candidateText))

  let matched = 0
  jobKeywords.forEach(kw => {
    if (candidateKeywords.has(kw) || candidateText.includes(kw)) matched++
  })

  const keywordScore = jobKeywords.size > 0 ? (matched / jobKeywords.size) * 100 : 50

  const hasExperience = experience.length > 50 ? 10 : 0
  const hasSkills = skills.length > 20 ? 10 : 0

  return Math.min(100, Math.round(keywordScore * 0.8 + hasExperience + hasSkills))
}

export function extractMatchedSkills(jobDesc, userSkills) {
  const jobKeywords = extractKeywords(jobDesc)
  const skills = userSkills.split(/[,\n]/).map(s => s.trim()).filter(Boolean)

  const matched = []
  const missing = []

  const techSkillsInJob = jobKeywords.filter(kw =>
    kw.length > 2 && /^[a-z]/.test(kw)
  )

  skills.forEach(skill => {
    const skillLower = skill.toLowerCase()
    if (jobDesc.toLowerCase().includes(skillLower)) {
      matched.push(skill)
    }
  })

  techSkillsInJob.slice(0, 10).forEach(kw => {
    const found = skills.some(s => s.toLowerCase().includes(kw))
    if (!found && kw.length > 3) {
      missing.push(kw)
    }
  })

  return { matched: matched.slice(0, 10), missing: missing.slice(0, 6) }
}
