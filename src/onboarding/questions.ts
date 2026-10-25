export const onboardingQuestions=[
  {id:'languages',question:'Which programming languages or stacks are you comfortable contributing to?',default:'Any / decide for me'},
  {id:'difficulty',question:'How challenging should the contribution be?',choices:['Beginner/small (roughly 1–3 hours)','Intermediate (roughly 3–8 hours)','Advanced (multi-day)','Decide for me'],default:'Decide for me'},
  {id:'repositoryPreference',question:'What sort of repository should I prioritize? You may add a domain and opt in to remembering these preferences.',choices:['Well-known projects','Smaller active projects','Highest realistic merge potential','Any'],default:'Any'}
] as const;
export function onboardingInteraction(formSupported:boolean){return {questions:onboardingQuestions,format:formSupported?'form':'text',text:onboardingQuestions.map((q,i)=>`${i+1}. ${q.question} Default: ${q.default}`).join('\n'),notice:'Time bands are estimates. If you provide only two answers, the remaining default is displayed and used. Saving preferences for future sessions is opt-in.'};}
