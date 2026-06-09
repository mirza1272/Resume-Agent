/**
 * GLOBAL ROLE-BASED EMAIL GENERATION SYSTEM
 * ==========================================
 * This is a STRICT deterministic email engine.
 * It detects the job role, selects the exact matching template,
 * and ONLY fills (Company Name). Nothing else is modified.
 */

// ── Role Classification ──────────────────────────────────────────────────────

function detectRolePipeline(jobDesc) {
  const text = jobDesc.toLowerCase()
  let title = ''

  // STEP 1: Extract Job Title
  // Priority: Open Positions, Position, Job Title, Role
  const lines = jobDesc.split('\n').map(l => l.trim()).filter(Boolean)
  
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase()
    const match = lineLower.match(/^(open positions?|position|job title|role)\s*:\s*(.*)$/)
    if (match) {
      if (match[2].trim() && !match[2].match(/^[-*•]/)) {
        title = match[2].trim()
      } else if (i + 1 < lines.length) {
        // Next line might be the first item in a bulleted list
        const nextLine = lines[i + 1].replace(/^[-*•\s]+/, '').trim()
        title = nextLine
      }
      break
    }
  }

  // Fallback to first few lines looking for obvious title
  if (!title) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const lineLower = lines[i].toLowerCase()
      if (/(engineer|developer|intern|internship|manager|designer|analyst|scientist)/.test(lineLower)) {
        title = lines[i]
        break
      }
    }
  }
  if (!title) title = lines[0] || ''

  // Force title to extract only the first role if comma separated
  title = title.split(',')[0].trim()

  // STEP 2: Detect Employment Type
  let empType = 'Full Time'
  const typeMatch = title.toLowerCase().match(/\b(internship|intern|trainee|associate|junior|part-time|part time|contract)\b/) || text.match(/\b(internship|intern|trainee|associate|junior|part-time|part time|contract)\b/)
  if (typeMatch) {
    empType = typeMatch[1].toLowerCase()
    if (empType === 'internship' || empType === 'intern') empType = 'Internship'
    else if (empType === 'part-time' || empType === 'part time') empType = 'Part Time'
    else empType = empType.charAt(0).toUpperCase() + empType.slice(1)
  }

  // STEP 3: Detect Role (Priority 1: Exact Title)
  let role = ''
  const titleLower = title.toLowerCase()

  if (titleLower.includes('ai/ml') || titleLower.includes('ai / ml')) role = 'AI_ML_ENGINEER'
  else if (titleLower.includes('machine learning')) role = 'ML_ENGINEER'
  else if (titleLower.match(/\bai\b/) && (titleLower.includes('engineer') || titleLower.includes('intern'))) role = 'AI_ENGINEER'
  else if (titleLower.includes('full stack') || titleLower.includes('fullstack')) role = 'FULL_STACK'
  else if (titleLower.includes('front end') || titleLower.includes('frontend')) role = 'FRONTEND'
  else if (titleLower.match(/\bweb\b/) && (titleLower.includes('developer') || titleLower.includes('development') || titleLower.includes('intern'))) role = 'WEB_DEVELOPER'
  else if (titleLower.includes('software')) role = 'SE'

  // STEP 4: Fallback to full text (Responsibilities / Skills)
  if (!role) {
    if (/\bai\s*\/?\s*ml\b/.test(text)) role = 'AI_ML_ENGINEER'
    else if (/machine\s*learning/.test(text) && !/\bai\b/.test(text)) role = 'ML_ENGINEER'
    else if (/\bai\s+(engineer|developer)\b/.test(text)) role = 'AI_ENGINEER'
    else if (/full[\s-]*stack/.test(text)) role = 'FULL_STACK'
    else if (/front[\s-]*end/.test(text)) role = 'FRONTEND'
    else if (/\bweb\s+developer\b/.test(text)) role = 'WEB_DEVELOPER'
    else if (/software\s+(engineer|developer)/.test(text)) role = 'SE'
    else role = 'AI_ML_ENGINEER' // Ultimate fallback
  }

  // Map to exact template key (handle SE Intern specifically if it exists)
  let selectedTemplate = role
  if (role === 'SE' && empType === 'Internship') {
    selectedTemplate = 'SE_INTERN'
  }

  // Internal Debug Output
  console.log(`Detected Role: ${role}`)
  console.log(`Detected Employment Type: ${empType}`)
  console.log(`Selected Template: ${selectedTemplate}`)

  return { selectedTemplate, empType }
}

// ── Company Name Extractor ───────────────────────────────────────────────────

function extractCompany(jobDesc) {
  // Priority: Strict field extraction
  const fieldPatterns = [
    /Company:\s*([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/i,
    /Company Name:\s*([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/i,
    /About Company:\s*([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/i,
    /Hiring Company:\s*([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/i,
    /Posted By:\s*([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/i,
    /Organization Name:\s*([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/i,
  ]
  for (const pattern of fieldPatterns) {
    const match = jobDesc.match(pattern)
    if (match && match[1] && !match[1].toLowerCase().includes('confidential')) return match[1].trim()
  }

  // Fallback: Try common patterns like "at Acme Corp" / "@ Acme" / "- Acme Inc"
  const patterns = [
    /\bat\s+([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/m,
    /company[:\s]+([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/im,
    /organization[:\s]+([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/im,
    /employer[:\s]+([A-Z][A-Za-z0-9&.\-\s]{1,40}?)(?:\s*[\n,|]|$)/im,
  ]
  for (const pattern of patterns) {
    const match = jobDesc.match(pattern)
    if (match && match[1] && !match[1].toLowerCase().includes('confidential')) return match[1].trim()
  }
  
  return 'your organization' // Never invent or hallucinate company names
}

// ── Email Templates ──────────────────────────────────────────────────────────

const TEMPLATES = {

  AI_ML_ENGINEER: (company) => ({
    subject: 'Application for AI/ML Engineer Position',
    body: `Dear Hiring Team,

I hope you are doing well.

I am writing to express my strong interest in the AI/ML Engineer position at ${company || 'your organization'}. As a Computer Science student with a deep passion for Artificial Intelligence and Machine Learning, I am genuinely excited about the opportunity to contribute to innovative AI-driven solutions while growing as an engineer.

Over the past year, I have dedicated significant time to learning and building projects in Machine Learning and Deep Learning. My experience includes supervised learning, data preprocessing, feature engineering, model evaluation, and developing deep learning models using TensorFlow and PyTorch. I have also worked on Computer Vision projects, including CNN-based image classification systems, and continue to expand my knowledge in Generative AI, LLMs, and modern AI technologies.

In addition to AI/ML, I have a strong programming background in Python and experience building real-world software projects. I enjoy solving challenging problems, learning new technologies, and collaborating with others to create impactful solutions.

The opportunity at ${company || 'your organization'} is particularly exciting to me because it aligns perfectly with my career goal of becoming an AI Engineer. I am highly motivated, eager to learn, and ready to contribute from day one.

Please find my resume attached for your review. I would be grateful for the opportunity to discuss how my skills, projects, and enthusiasm can contribute to your team.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
Haseeb ur Rahman
Phone: +92 303 8607925
Portfolio: https://mirzahaseeb.me
GitHub: https://github.com/mirza1272`
  }),

  ML_ENGINEER: (company) => ({
    subject: 'Application for Machine Learning Engineer Position',
    body: `Dear Hiring Team,

I hope you are doing well.

I am writing to apply for the Machine Learning Engineer position at ${company || 'your organization'}. As a Computer Science student with a strong foundation in machine learning and data-driven problem solving, I am excited about the opportunity to contribute to impactful ML systems.

Over the past year, I have worked extensively on supervised and unsupervised learning algorithms, model training, evaluation, and optimization. I have experience in data preprocessing, feature engineering, and working with datasets to build predictive models. My projects include classification systems and regression-based models using Python and Scikit-learn, along with deep learning implementations using TensorFlow and PyTorch.

I am particularly interested in this opportunity because it aligns with my goal of building scalable and production-ready machine learning systems. I am eager to apply my analytical thinking and technical skills in a professional environment.

Please find my resume attached for your review. I would appreciate the opportunity to contribute to your team and grow as a Machine Learning Engineer.

Thank you for your time and consideration.

Best regards,
Haseeb ur Rahman
Phone: +92 303 8607925
Portfolio: https://mirzahaseeb.me
GitHub: https://github.com/mirza1272`
  }),

  AI_ENGINEER: (company) => ({
    subject: 'Application for AI Engineer Position',
    body: `Dear Hiring Team,

I hope you are doing well.

I am writing to express my interest in the AI Engineer position at ${company || 'your organization'}. I am a Computer Science student passionate about building end-to-end AI systems that combine machine learning, software engineering, and real-world deployment.

My experience includes developing AI-based applications, working with machine learning models, and integrating intelligent systems into software products. I have hands-on experience in Python, deep learning, and building projects involving computer vision and automation. I am also exploring LLMs and modern AI system design.

I am particularly interested in this role because it focuses on practical AI system development, which aligns with my long-term goal of becoming a production-level AI engineer. I enjoy solving real-world problems and turning AI models into usable applications.

Please find my resume attached for your review. I would be grateful for the opportunity to contribute to your organization.

Thank you for your time and consideration.

Best regards,
Haseeb ur Rahman
Phone: +92 303 8607925
Portfolio: https://mirzahaseeb.me
GitHub: https://github.com/mirza1272`
  }),

  // ── Web / Frontend Templates ─────────────────────────────────────────────

  FULL_STACK: (company) => ({
    subject: 'Application for Full Stack Developer Position',
    body: `Dear Hiring Team,

I hope you are doing well.

I am writing to express my interest in the Full Stack Developer position at ${company || 'your organization'}. As a Computer Science student with a strong foundation in software development and web technologies, I am eager to contribute to building scalable and efficient full-stack applications.

I have practical experience in developing end-to-end web applications, including frontend interfaces, backend APIs, and database integration. I enjoy building clean, structured, and user-focused applications that solve real-world problems and deliver strong performance.

This opportunity particularly interests me because it aligns with my goal of becoming a professional full-stack developer capable of designing and developing production-level systems. I am highly motivated to learn, improve, and contribute effectively to your development team.

Please find my resume attached for your review. I would appreciate the opportunity to discuss how my skills and projects can add value to your organization.

Thank you for your time and consideration.

Best regards,
Haseeb ur Rahman
Phone: +92 303 8607925
Portfolio: https://mirzahaseeb.me
GitHub: https://github.com/mirza1272`
  }),

  FRONTEND: (company) => ({
    subject: 'Application for Frontend Developer Position',
    body: `Dear Hiring Team,

I hope you are doing well.

I am writing to apply for the Frontend Developer position at ${company || 'your organization'}. I am a Computer Science student with a strong focus on creating modern, responsive, and user-friendly web interfaces.

I have experience in building visually appealing and responsive websites using modern frontend development principles. I focus on user experience, performance optimization, and converting UI designs into functional web applications. I also have experience integrating APIs and ensuring smooth frontend-backend communication.

This role strongly aligns with my goal of becoming a skilled frontend engineer who builds high-quality, production-ready interfaces. I am passionate about improving user experience and continuously enhancing my technical skills.

Please find my resume attached for your review. I would be grateful for the opportunity to contribute to your team.

Thank you for your time and consideration.

Best regards,
Haseeb ur Rahman
Phone: +92 303 8607925
Portfolio: https://mirzahaseeb.me
GitHub: https://github.com/mirza1272`
  }),

  WEB_DEVELOPER: (company) => ({
    subject: 'Application for Web Developer Position',
    body: `Dear Hiring Team,

I hope you are doing well.

I am writing to express my interest in the Web Developer position at ${company || 'your organization'}. As a Computer Science student with strong enthusiasm for web development, I enjoy building functional, responsive, and performance-optimized websites.

I have hands-on experience in developing web applications, working with frontend and backend integration, and creating user-friendly digital solutions. I focus on writing clean code, improving website performance, and delivering smooth user experiences.

This opportunity aligns with my goal of becoming a professional web developer capable of building scalable and real-world applications. I am eager to contribute to your development team and grow my technical expertise.

Please find my resume attached for your review. I would appreciate the opportunity to contribute to your organization.

Thank you for your time and consideration.

Best regards,
Haseeb ur Rahman
Phone: +92 303 8607925
Portfolio: https://mirzahaseeb.me
GitHub: https://github.com/mirza1272`
  }),

  // ── Software Engineer Templates ────────────────────────────────────────────

  SE: (company) => ({
    subject: 'Application for Software Engineer Position',
    body: `Dear Hiring Team,

I hope you are doing well.

I am writing to express my interest in the Software Engineer position at ${company || 'your organization'}. As a Computer Science student with a strong foundation in programming and software development, I am eager to contribute to building scalable, efficient, and high-quality software systems.

I have hands-on experience in developing real-world applications, working with problem-solving algorithms, and building projects that involve both frontend and backend development. I enjoy writing clean, maintainable code and continuously improving system performance and functionality.

This opportunity strongly aligns with my goal of becoming a professional software engineer capable of designing and developing production-level systems. I am highly motivated to learn, adapt, and contribute effectively to your engineering team.

Please find my resume attached for your review. I would appreciate the opportunity to discuss how my skills and projects can add value to your organization.

Thank you for your time and consideration.

Best regards,
Haseeb ur Rahman
Phone: +92 303 8607925
Portfolio: https://mirzahaseeb.me
GitHub: https://github.com/mirza1272`
  }),

  SE_INTERN: (company) => ({
    subject: 'Application for Software Engineer Internship',
    body: `Dear Hiring Team,

I hope you are doing well.

I am writing to apply for the Software Engineer Internship at ${company || 'your organization'}. As a Computer Science student with a strong interest in software development, I am excited about the opportunity to gain practical experience and contribute to real-world engineering projects.

I have been actively learning and practicing programming fundamentals, data structures, and software development principles. I have also worked on small to medium-scale projects that helped me understand application design, debugging, and problem-solving in real scenarios.

This internship strongly aligns with my goal of becoming a skilled software engineer. I am eager to learn from experienced professionals and contribute positively to your development team.

Please find my resume attached for your review. I would be grateful for the opportunity to be part of your organization and grow as a developer.

Thank you for your time and consideration.

Best regards,
Haseeb ur Rahman
Phone: +92 303 8607925
Portfolio: https://mirzahaseeb.me
GitHub: https://github.com/mirza1272`
  }),
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a deterministic email based on job description.
 * @param {string} jobDesc - The raw job description text
 * @returns {{ subject: string, body: string }}
 */
export function generateEmail(jobDesc) {
  const { selectedTemplate, empType } = detectRolePipeline(jobDesc)
  const company = extractCompany(jobDesc)
  const templateFn = TEMPLATES[selectedTemplate] || TEMPLATES.AI_ML_ENGINEER
  const email = templateFn(company)

  // Dynamically adapt email text for Internships if not using a specific intern template
  if (empType === 'Internship' && selectedTemplate !== 'SE_INTERN') {
    email.subject = email.subject.replace('Position', 'Internship')
    email.body = email.body.replace('position', 'Internship')
  }

  return email
}
