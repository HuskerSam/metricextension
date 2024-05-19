export const exampleMetrics = () => {
    return [
        {
            metricType: "score 0-10",
            title: "Language Score 0 - 10",
            template: `Describe language suitability for under age audiences.
Please respond with a number between 0 and 10.
            
Please respond with json and only json in this format:
{
    "contentRating": 0
}

Here is the content to analyze:
{{query}}`,
        }, {
            metricType: "text",
            title: "Keywords",
            template: `Use the following format to answer, include up to 5: 
Keywords: [keyword1], [keyword2], [keyword3], ...

Here is the content to analyze:
{{query}}`,
        }, {
            metricType: "text",
            title: "Summary",
            template: `This summary should be no longer than 50 or more words. Use the following format to answer:
Summary: [summary of content]

Here is the content to analyze:
{{query}}`,
        }, {
            metricType: "json",
            title: "JSON repsonse",
            template: `Here is the content to analyze:
{{query}}

Please respond with json and only json in this format:
{
    "contentRating": 0,
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "summary": "summary of content"
}`,
        }, {
            metricType: "score 0-10",
            title: "Indicators of Propaganda Score 0 - 10",
            template: `Evaluate the provided web scraped article for linguistic indicators suggestive of propaganda rather than objective truth. Rely on research-backed linguistic markers while recognizing the limitations of text-based assessments. Specifically, consider:

            A. Defining Variable - Indicators of Propaganda 
            1. Loaded Language
                Description: Use of emotionally charged words to influence the reader.
                Indicators:  
                    - Exaggerated or hyperbolic language.
                    - Words that evoke strong positive or negative emotions.
        
            2. One-sided Argumentation  
                Description: Presenting only one perspective while ignoring or discrediting opposing views.
                Indicators:
                    - Lack of balanced perspective or acknowledgment of counterarguments.
                    - Dismissive or demeaning references to opposing viewpoints.
        
            3. Unverifiable Claims
                Description: Assertions made without supporting evidence or sources.
                Indicators:  
                    - Statements presented as facts without citations or references.
                    - Use of vague terms like "studies show" or "experts say" without specifics.
        
            4. Appeal to Fear or Anger
                Description: Attempts to provoke fear or anger to persuade the reader.
                Indicators:
                    - Language that stokes anxiety, outrage or a sense of threat.
                    - Portraying situations as dire to create a sense of urgency.
        
            5. Bandwagon Appeal
                Description: Suggesting an idea is valid because many people believe it.
                Indicators:  
                    - References to the popularity of an idea as a substitute for evidence.
                    - Encouraging conformity to a viewpoint to avoid being in the minority.
        
            6. Ad Hominem Attacks
                Description: Attacking the character of a person rather than engaging their arguments.
                Indicators:
                    - Personal insults or disparaging remarks about individuals.
                    - Dismissing ideas based on attacks on those proposing them.
        
            B. Scoring 
            a. Rating
                Scale:
                    1-2 (Very Mild or Non-existent indicators): Propaganda indicators are either very mild or do not exist. If an indicator is non-existent within the article, score 1.
                    3-4 (Low Indicators): Occasional use of propaganda techniques, but the article mostly presents information objectively. 
                    5-7 (Moderate Indicators): Several instances of propaganda indicators, suggesting a clear bias and intent to persuade.
                    8-10 (High Indicators): Pervasive use of propaganda techniques, with little to no attempt at objectivity or balanced reporting.
        
            b. Assigning Weight
                Weights:
                Loaded Language (20%): Emotionally charged language is a potent tool for swaying readers and a strong indicator of propaganda.
        
                One-sided Argumentation (20%): Failing to present a balanced perspective suggests an intent to promote a specific viewpoint rather than inform.
                
                Unverifiable Claims (15%): A lack of supporting evidence or sources raises questions about the credibility of the information presented.
                
                Appeal to Fear or Anger (15%): Provoking strong emotions can cloud judgment and is a common tactic in propaganda.
                
                Bandwagon Appeal (15%): Appealing to popularity rather than evidence is a weak argument and often used in propaganda.
                
                Ad Hominem Attacks (15%): Attacking individuals rather than engaging with their ideas is a diversionary tactic that undermines objectivity.
                
                    After weighting, round to the nearest whole number and return that value in JSON 'score' response.
            
                    After scoring, provide a comprehensive breakdown of the factors contributing to the score. Highlight the key passages or patterns that were particularly influential in the decision.
            Please respond with json and only json in this format:
            {
                "contentRating": 0
            }
            
            Here is the content to analyze:
            {{query}}`,
        },
    ];
}