# Government Component Synergy Reference

**Last updated:** 2026-10-15

Every pair of government components that works well together or against each other. This list is generated from the
one shared table, `src/lib/government/synergy-table.ts` (pairs in `synergy-pairs-1.ts` and `synergy-pairs-2.ts`),
which the founding picker, the editor, the nation card preview, founding and the server save all read.

## How pairs are scored

`governmentEffectiveness` (`src/lib/government/effectiveness.ts`):

```text
Base effectiveness = mean of the components' effectiveness scores
Synergy bonus      = 10 for each pair that works well together
Conflict penalty   = 15 for each pair that works against each other
Final              = clamp(base + synergy bonus - conflict penalty, 0, 100)
```

`synergyScoreDelta` gives each pair's points; `findSynergyPair(a, b)` and `checkComponentSynergy(a, b)` look a pair
up in either order. A test checks that every pair is symmetric, names only defined components and appears once.

## Pairs that work well together (106, +10 each)

| Component | Component | Why |
| --- | --- | --- |
| Centralized power structure (`CENTRALIZED_POWER`) | Autocratic decision making (`AUTOCRATIC_PROCESS`) | Central control makes a single ruler's decisions easy to carry out. |
| Centralized power structure (`CENTRALIZED_POWER`) | Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | A strong centre gives the civil service one clear chain of command. |
| Centralized power structure (`CENTRALIZED_POWER`) | Emergency response (`EMERGENCY_RESPONSE`) | A strong centre can order a fast response when disaster strikes. |
| Unitary government (`UNITARY_SYSTEM`) | Centralized power structure (`CENTRALIZED_POWER`) | A single level of government keeps control in the capital. |
| Unitary government (`UNITARY_SYSTEM`) | Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | One national civil service runs the same way everywhere. |
| Federal power distribution (`FEDERAL_SYSTEM`) | Democratic decision making (`DEMOCRATIC_PROCESS`) | Regional governments give voters more places to have a say. |
| Federal power distribution (`FEDERAL_SYSTEM`) | Rule of law (`RULE_OF_LAW`) | Clear laws settle disputes between the national and regional governments. |
| Federal power distribution (`FEDERAL_SYSTEM`) | Administrative decentralization (`ADMINISTRATIVE_DECENTRALIZATION`) | Regions with their own powers are ready to run local services. |
| Confederate system (`CONFEDERATE_SYSTEM`) | Consensus decision making (`CONSENSUS_PROCESS`) | Member regions keep working together by reaching broad agreement. |
| Confederate system (`CONFEDERATE_SYSTEM`) | Traditional legitimacy (`TRADITIONAL_LEGITIMACY`) | Long-standing customs hold a loose union of regions together. |
| Administrative decentralization (`ADMINISTRATIVE_DECENTRALIZATION`) | Consensus decision making (`CONSENSUS_PROCESS`) | Local offices that share power are used to reaching agreement. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Electoral legitimacy (`ELECTORAL_LEGITIMACY`) | Free elections give elected leaders a clear mandate. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Rule of law (`RULE_OF_LAW`) | Laws that apply to everyone keep democratic decisions fair. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | E-Governance (`E_GOVERNANCE`) | Online tools make it easier for citizens to take part. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Minority rights (`MINORITY_RIGHTS`) | Protected minorities can take full part in democratic life. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Multilateral diplomacy (`MULTILATERAL_DIPLOMACY`) | Democracies find it easier to build trust in international bodies. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Social safety net (`SOCIAL_SAFETY_NET`) | Voters back a safety net that protects them in hard times. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Welfare state (`WELFARE_STATE`) | Voters keep up the public services they use every day. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Worker protection (`WORKER_PROTECTION`) | Workers can vote for the laws that protect them. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | Charismatic legitimacy (`CHARISMATIC_LEGITIMACY`) | A popular leader makes rule by one person easier to accept. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | Military enforcement (`MILITARY_ENFORCEMENT`) | The army enforces the decisions of a single ruler. |
| Military administration (`MILITARY_ADMINISTRATION`) | Autocratic decision making (`AUTOCRATIC_PROCESS`) | A military chain of command suits rule from the top. |
| Surveillance system (`SURVEILLANCE_SYSTEM`) | Autocratic decision making (`AUTOCRATIC_PROCESS`) | Watching the population helps a single ruler stay in control. |
| Technocratic decision making (`TECHNOCRATIC_PROCESS`) | Performance legitimacy (`PERFORMANCE_LEGITIMACY`) | Experts in charge earn support by delivering results. |
| Technocratic decision making (`TECHNOCRATIC_PROCESS`) | Technocratic agencies (`TECHNOCRATIC_AGENCIES`) | Expert decision makers rely on expert agencies to carry out plans. |
| Strategic planning (`STRATEGIC_PLANNING`) | Technocratic decision making (`TECHNOCRATIC_PROCESS`) | Experts in charge make the most of long-term plans. |
| Consensus decision making (`CONSENSUS_PROCESS`) | Traditional legitimacy (`TRADITIONAL_LEGITIMACY`) | Shared customs give everyone a starting point for agreement. |
| Social pressure (`SOCIAL_PRESSURE`) | Consensus decision making (`CONSENSUS_PROCESS`) | Community expectations help people settle on a shared decision. |
| Oligarchic decision making (`OLIGARCHIC_PROCESS`) | Economic incentives (`ECONOMIC_INCENTIVES`) | A small elite rewards those who keep it in power. |
| Oligarchic decision making (`OLIGARCHIC_PROCESS`) | Surveillance system (`SURVEILLANCE_SYSTEM`) | Monitoring helps a small elite spot challenges early. |
| Partisan institutions (`PARTISAN_INSTITUTIONS`) | Oligarchic decision making (`OLIGARCHIC_PROCESS`) | Loyal appointees keep a small elite in charge. |
| Partisan institutions (`PARTISAN_INSTITUTIONS`) | Economic incentives (`ECONOMIC_INCENTIVES`) | Party-run institutions hand out jobs and favours to loyal supporters. |
| Electoral legitimacy (`ELECTORAL_LEGITIMACY`) | Independent judiciary (`INDEPENDENT_JUDICIARY`) | Independent courts protect the fairness of elections. |
| Electoral legitimacy (`ELECTORAL_LEGITIMACY`) | Rule of law (`RULE_OF_LAW`) | Elections run under clear laws are trusted by winners and losers alike. |
| Traditional legitimacy (`TRADITIONAL_LEGITIMACY`) | Religious legitimacy (`RELIGIOUS_LEGITIMACY`) | Custom and faith each lend weight to the same rulers. |
| Performance legitimacy (`PERFORMANCE_LEGITIMACY`) | Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | A capable civil service delivers the results that earn public support. |
| Performance legitimacy (`PERFORMANCE_LEGITIMACY`) | Performance management (`PERFORMANCE_MANAGEMENT`) | Measuring results shows the public what the government delivers. |
| Performance legitimacy (`PERFORMANCE_LEGITIMACY`) | Technocratic agencies (`TECHNOCRATIC_AGENCIES`) | Expert agencies deliver the results that earn public support. |
| Merit-Based system (`MERIT_BASED_SYSTEM`) | Performance legitimacy (`PERFORMANCE_LEGITIMACY`) | Hiring on ability helps the government deliver results. |
| Economic incentives (`ECONOMIC_INCENTIVES`) | Performance legitimacy (`PERFORMANCE_LEGITIMACY`) | Rising prosperity is the result people judge the government on. |
| Charismatic legitimacy (`CHARISMATIC_LEGITIMACY`) | Social pressure (`SOCIAL_PRESSURE`) | A popular leader rallies communities to fall in line. |
| Religious legitimacy (`RELIGIOUS_LEGITIMACY`) | Social pressure (`SOCIAL_PRESSURE`) | Community expectations reinforce religious authority. |
| Social pressure (`SOCIAL_PRESSURE`) | Traditional legitimacy (`TRADITIONAL_LEGITIMACY`) | Community expectations keep traditions alive. |
| Cultural preservation (`CULTURAL_PRESERVATION`) | Social pressure (`SOCIAL_PRESSURE`) | Communities help pass shared customs on to the next generation. |
| Cultural preservation (`CULTURAL_PRESERVATION`) | Traditional legitimacy (`TRADITIONAL_LEGITIMACY`) | Protecting heritage strengthens rulers whose authority rests on tradition. |
| Institutional legitimacy (`INSTITUTIONAL_LEGITIMACY`) | Rule of law (`RULE_OF_LAW`) | People trust institutions that follow the law. |
| Institutional legitimacy (`INSTITUTIONAL_LEGITIMACY`) | Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | A capable civil service makes public institutions worth trusting. |
| Institutional legitimacy (`INSTITUTIONAL_LEGITIMACY`) | Independent judiciary (`INDEPENDENT_JUDICIARY`) | Independent courts show that no office is above the rules. |
| Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | Rule of law (`RULE_OF_LAW`) | A professional civil service applies the law the same way to everyone. |
| Merit-Based system (`MERIT_BASED_SYSTEM`) | Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | Hiring on ability keeps the civil service skilled. |
| Independent judiciary (`INDEPENDENT_JUDICIARY`) | Rule of law (`RULE_OF_LAW`) | Independent courts make sure the law is applied fairly. |
| Digital government (`DIGITAL_GOVERNMENT`) | Digital infrastructure (`DIGITAL_INFRASTRUCTURE`) | Online public services need fast, reliable networks. |
| Digital government (`DIGITAL_GOVERNMENT`) | E-Governance (`E_GOVERNANCE`) | Online services and online participation run on the same systems. |
| Digital government (`DIGITAL_GOVERNMENT`) | Performance management (`PERFORMANCE_MANAGEMENT`) | Digital services make results easy to measure. |
| Performance management (`PERFORMANCE_MANAGEMENT`) | Quality assurance (`QUALITY_ASSURANCE`) | Tracking results and checking quality improve services together. |
| Performance management (`PERFORMANCE_MANAGEMENT`) | Strategic planning (`STRATEGIC_PLANNING`) | Measured results show whether long-term plans are working. |
| Quality assurance (`QUALITY_ASSURANCE`) | Technocratic agencies (`TECHNOCRATIC_AGENCIES`) | Expert agencies hold public services to clear standards. |
| Risk management (`RISK_MANAGEMENT`) | Strategic planning (`STRATEGIC_PLANNING`) | Planning ahead includes preparing for what could go wrong. |
| Military administration (`MILITARY_ADMINISTRATION`) | Military enforcement (`MILITARY_ENFORCEMENT`) | Soldiers both run the state and enforce its orders. |
| Military administration (`MILITARY_ADMINISTRATION`) | Security alliances (`SECURITY_ALLIANCES`) | A military government works easily with allied armed forces. |
| Emergency response (`EMERGENCY_RESPONSE`) | Military administration (`MILITARY_ADMINISTRATION`) | Military logistics speed up the response to emergencies. |
| Counter-Terrorism (`COUNTER_TERRORISM`) | Military administration (`MILITARY_ADMINISTRATION`) | Military command structures support counter-terrorism operations. |
| Counter-Terrorism (`COUNTER_TERRORISM`) | Surveillance system (`SURVEILLANCE_SYSTEM`) | Monitoring helps find threats before they strike. |
| Cybersecurity (`CYBERSECURITY`) | Digital infrastructure (`DIGITAL_INFRASTRUCTURE`) | Protected networks keep the digital economy running. |
| Cybersecurity (`CYBERSECURITY`) | Technocratic agencies (`TECHNOCRATIC_AGENCIES`) | Expert agencies defend government systems. |
| Disaster preparedness (`DISASTER_PREPAREDNESS`) | Risk management (`RISK_MANAGEMENT`) | Knowing the risks shows where to prepare for disasters. |
| Disaster preparedness (`DISASTER_PREPAREDNESS`) | Strategic planning (`STRATEGIC_PLANNING`) | Long-term plans pay for preparation before disasters strike. |
| Emergency response (`EMERGENCY_RESPONSE`) | Risk management (`RISK_MANAGEMENT`) | Known risks come with rehearsed emergency plans. |
| Crisis communication (`CRISIS_COMMUNICATION`) | Emergency response (`EMERGENCY_RESPONSE`) | Clear public messages make an emergency response work. |
| Crisis communication (`CRISIS_COMMUNICATION`) | Digital government (`DIGITAL_GOVERNMENT`) | Digital channels get warnings to people quickly. |
| Recovery planning (`RECOVERY_PLANNING`) | Strategic planning (`STRATEGIC_PLANNING`) | Long-term plans speed up rebuilding after a crisis. |
| Economic incentives (`ECONOMIC_INCENTIVES`) | Recovery planning (`RECOVERY_PLANNING`) | Grants and rewards speed up rebuilding after a crisis. |
| Resilience building (`RESILIENCE_BUILDING`) | Strategic planning (`STRATEGIC_PLANNING`) | Planning ahead makes the country harder to knock over. |
| Resilience building (`RESILIENCE_BUILDING`) | Social safety net (`SOCIAL_SAFETY_NET`) | A safety net helps households get through shocks. |
| Pandemic management (`PANDEMIC_MANAGEMENT`) | Technocratic agencies (`TECHNOCRATIC_AGENCIES`) | Public health experts lead the response to outbreaks. |
| Pandemic management (`PANDEMIC_MANAGEMENT`) | Universal healthcare (`UNIVERSAL_HEALTHCARE`) | Everyone can be tested and treated during an outbreak. |
| Social safety net (`SOCIAL_SAFETY_NET`) | Universal healthcare (`UNIVERSAL_HEALTHCARE`) | Health cover and basic support protect people together. |
| Social safety net (`SOCIAL_SAFETY_NET`) | Welfare state (`WELFARE_STATE`) | A safety net is the core of a welfare state. |
| Social safety net (`SOCIAL_SAFETY_NET`) | Worker protection (`WORKER_PROTECTION`) | Labour rules and basic support catch workers who lose their jobs. |
| Universal healthcare (`UNIVERSAL_HEALTHCARE`) | Welfare state (`WELFARE_STATE`) | Healthcare for everyone is a pillar of the welfare state. |
| Public education (`PUBLIC_EDUCATION`) | Welfare state (`WELFARE_STATE`) | Free schooling is a pillar of the welfare state. |
| Minority rights (`MINORITY_RIGHTS`) | Rule of law (`RULE_OF_LAW`) | Laws that apply to everyone protect minorities. |
| Environmental protection (`ENVIRONMENTAL_PROTECTION`) | International law (`INTERNATIONAL_LAW`) | Climate and nature treaties back up national rules. |
| Environmental protection (`ENVIRONMENTAL_PROTECTION`) | Technocratic decision making (`TECHNOCRATIC_PROCESS`) | Experts set environmental rules based on evidence. |
| Digital infrastructure (`DIGITAL_INFRASTRUCTURE`) | Smart cities (`SMART_CITIES`) | Smart cities run on fast, reliable networks. |
| Smart cities (`SMART_CITIES`) | Technocratic agencies (`TECHNOCRATIC_AGENCIES`) | Expert agencies keep city systems running well. |
| Central economic planning (`PLANNED_ECONOMY`) | Centralized power structure (`CENTRALIZED_POWER`) | Central control lets the state direct the whole economy. |
| Central economic planning (`PLANNED_ECONOMY`) | Technocratic decision making (`TECHNOCRATIC_PROCESS`) | Experts in charge draw up more workable economic plans. |
| Central economic planning (`PLANNED_ECONOMY`) | Strategic planning (`STRATEGIC_PLANNING`) | Long-term planning gives the state's economic targets a direction. |
| Entrepreneurship support (`ENTREPRENEURSHIP_SUPPORT`) | Innovation ecosystem (`INNOVATION_ECOSYSTEM`) | New businesses turn fresh ideas into products. |
| Entrepreneurship support (`ENTREPRENEURSHIP_SUPPORT`) | Startup incubation (`STARTUP_INCUBATION`) | Help for founders and incubators reach the same new businesses. |
| Innovation ecosystem (`INNOVATION_ECOSYSTEM`) | Research and development (`RESEARCH_AND_DEVELOPMENT`) | Public research feeds new ideas to businesses. |
| Innovation ecosystem (`INNOVATION_ECOSYSTEM`) | Startup incubation (`STARTUP_INCUBATION`) | Incubators help new ideas grow into companies. |
| Intellectual property (`INTELLECTUAL_PROPERTY`) | Rule of law (`RULE_OF_LAW`) | Courts that enforce the law protect inventors and creators. |
| Research and development (`RESEARCH_AND_DEVELOPMENT`) | Technocratic agencies (`TECHNOCRATIC_AGENCIES`) | Expert agencies put research to practical use. |
| Research and development (`RESEARCH_AND_DEVELOPMENT`) | Technology transfer (`TECHNOLOGY_TRANSFER`) | Sharing technology spreads the results of research. |
| Bilateral relations (`BILATERAL_RELATIONS`) | Security alliances (`SECURITY_ALLIANCES`) | Close ties with partner countries underpin alliances. |
| Bilateral relations (`BILATERAL_RELATIONS`) | Trade agreements (`TRADE_AGREEMENTS`) | Close ties with partner countries lead to trade deals. |
| Development aid (`DEVELOPMENT_AID`) | Multilateral diplomacy (`MULTILATERAL_DIPLOMACY`) | International bodies channel aid to where it is needed. |
| Humanitarian intervention (`HUMANITARIAN_INTERVENTION`) | International law (`INTERNATIONAL_LAW`) | Treaties give interventions a legal basis. |
| Humanitarian intervention (`HUMANITARIAN_INTERVENTION`) | Multilateral diplomacy (`MULTILATERAL_DIPLOMACY`) | Interventions backed by international bodies win wider support. |
| International law (`INTERNATIONAL_LAW`) | Multilateral diplomacy (`MULTILATERAL_DIPLOMACY`) | International bodies write and uphold treaties. |
| International law (`INTERNATIONAL_LAW`) | Rule of law (`RULE_OF_LAW`) | Respect for the law at home carries over to treaties abroad. |
| International law (`INTERNATIONAL_LAW`) | Technology transfer (`TECHNOLOGY_TRANSFER`) | Treaties make it easier to share technology across borders. |
| Multilateral diplomacy (`MULTILATERAL_DIPLOMACY`) | Regional integration (`REGIONAL_INTEGRATION`) | Working through international bodies supports regional cooperation. |
| Regional integration (`REGIONAL_INTEGRATION`) | Trade agreements (`TRADE_AGREEMENTS`) | Regional blocs come with trade deals between neighbours. |

## Pairs that work against each other (48, -15 each)

| Component | Component | Why |
| --- | --- | --- |
| Centralized power structure (`CENTRALIZED_POWER`) | Federal power distribution (`FEDERAL_SYSTEM`) | A strong centre overrides the powers of regional governments. |
| Centralized power structure (`CENTRALIZED_POWER`) | Consensus decision making (`CONSENSUS_PROCESS`) | A strong centre leaves little room for decisions by broad agreement. |
| Centralized power structure (`CENTRALIZED_POWER`) | Administrative decentralization (`ADMINISTRATIVE_DECENTRALIZATION`) | A strong centre pulls back the powers handed to local offices. |
| Confederate system (`CONFEDERATE_SYSTEM`) | Centralized power structure (`CENTRALIZED_POWER`) | Member regions of a confederation resist a strong centre. |
| Confederate system (`CONFEDERATE_SYSTEM`) | Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | A loose union of regions struggles to run one national civil service. |
| Unitary government (`UNITARY_SYSTEM`) | Federal power distribution (`FEDERAL_SYSTEM`) | Power cannot sit with one national government and be shared with regions at once. |
| Unitary government (`UNITARY_SYSTEM`) | Confederate system (`CONFEDERATE_SYSTEM`) | A single national government clashes with self-governing member regions. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Autocratic decision making (`AUTOCRATIC_PROCESS`) | Decisions cannot be made by voters and by a single ruler at once. |
| Democratic decision making (`DEMOCRATIC_PROCESS`) | Military administration (`MILITARY_ADMINISTRATION`) | Military rule works against elected government: both weaken. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | Consensus decision making (`CONSENSUS_PROCESS`) | Rule by one person leaves no room for decisions by broad agreement. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | Electoral legitimacy (`ELECTORAL_LEGITIMACY`) | Rule by one person empties elections of meaning. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | Independent judiciary (`INDEPENDENT_JUDICIARY`) | A single ruler and independent courts keep clashing over who has the final say. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | International law (`INTERNATIONAL_LAW`) | A single ruler resists treaty obligations that limit their power. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | Minority rights (`MINORITY_RIGHTS`) | Rule by one person rarely protects minorities who object to it. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | E-Governance (`E_GOVERNANCE`) | Rule by one person has little use for citizens taking part online. |
| Autocratic decision making (`AUTOCRATIC_PROCESS`) | Administrative decentralization (`ADMINISTRATIVE_DECENTRALIZATION`) | A single ruler distrusts local offices acting on their own. |
| Federal power distribution (`FEDERAL_SYSTEM`) | Autocratic decision making (`AUTOCRATIC_PROCESS`) | Rule by one person overrides the powers of regional governments. |
| Rule of law (`RULE_OF_LAW`) | Autocratic decision making (`AUTOCRATIC_PROCESS`) | A ruler who stands above the law undermines it for everyone. |
| Oligarchic decision making (`OLIGARCHIC_PROCESS`) | Democratic decision making (`DEMOCRATIC_PROCESS`) | A small elite in charge works against rule by voters. |
| Oligarchic decision making (`OLIGARCHIC_PROCESS`) | Electoral legitimacy (`ELECTORAL_LEGITIMACY`) | Elite control empties elections of meaning. |
| Technocratic decision making (`TECHNOCRATIC_PROCESS`) | Charismatic legitimacy (`CHARISMATIC_LEGITIMACY`) | Rule by experts clashes with rule by a popular personality. |
| Technocratic decision making (`TECHNOCRATIC_PROCESS`) | Traditional legitimacy (`TRADITIONAL_LEGITIMACY`) | Expert judgement clashes with doing things the way they have always been done. |
| Consensus decision making (`CONSENSUS_PROCESS`) | Emergency response (`EMERGENCY_RESPONSE`) | Waiting for broad agreement slows the response to emergencies. |
| Traditional legitimacy (`TRADITIONAL_LEGITIMACY`) | Performance legitimacy (`PERFORMANCE_LEGITIMACY`) | Authority from custom and authority from results pull in different directions. |
| Charismatic legitimacy (`CHARISMATIC_LEGITIMACY`) | Performance legitimacy (`PERFORMANCE_LEGITIMACY`) | Personal appeal and measured results pull support in different directions. |
| Charismatic legitimacy (`CHARISMATIC_LEGITIMACY`) | Institutional legitimacy (`INSTITUTIONAL_LEGITIMACY`) | Loyalty to one person weakens trust in institutions. |
| Charismatic legitimacy (`CHARISMATIC_LEGITIMACY`) | Performance management (`PERFORMANCE_MANAGEMENT`) | Leaders who rule by personal appeal resist having their results measured. |
| Charismatic legitimacy (`CHARISMATIC_LEGITIMACY`) | Strategic planning (`STRATEGIC_PLANNING`) | Plans shift with the leader's wishes, so long-term planning suffers. |
| Religious legitimacy (`RELIGIOUS_LEGITIMACY`) | Technocratic decision making (`TECHNOCRATIC_PROCESS`) | Religious authority and expert judgement compete for the final word. |
| Religious legitimacy (`RELIGIOUS_LEGITIMACY`) | Rule of law (`RULE_OF_LAW`) | Religious law and secular law compete for the final word. |
| Economic incentives (`ECONOMIC_INCENTIVES`) | Religious legitimacy (`RELIGIOUS_LEGITIMACY`) | Buying loyalty with money cheapens authority that rests on faith. |
| Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | Partisan institutions (`PARTISAN_INSTITUTIONS`) | Jobs for party loyalists undermine a civil service hired on ability. |
| Professional bureaucracy (`PROFESSIONAL_BUREAUCRACY`) | Military administration (`MILITARY_ADMINISTRATION`) | Military command pushes the civilian civil service aside. |
| Military administration (`MILITARY_ADMINISTRATION`) | Independent judiciary (`INDEPENDENT_JUDICIARY`) | Military rule works against independent courts: both weaken. |
| Electoral legitimacy (`ELECTORAL_LEGITIMACY`) | Military administration (`MILITARY_ADMINISTRATION`) | Military rule overrides the result of elections. |
| Partisan institutions (`PARTISAN_INSTITUTIONS`) | Independent judiciary (`INDEPENDENT_JUDICIARY`) | Party control of institutions threatens the independence of the courts. |
| Technocratic agencies (`TECHNOCRATIC_AGENCIES`) | Partisan institutions (`PARTISAN_INSTITUTIONS`) | Party loyalists push experts out of their agencies. |
| Merit-Based system (`MERIT_BASED_SYSTEM`) | Partisan institutions (`PARTISAN_INSTITUTIONS`) | Hiring on ability clashes with hiring on loyalty. |
| Merit-Based system (`MERIT_BASED_SYSTEM`) | Traditional legitimacy (`TRADITIONAL_LEGITIMACY`) | Hiring on ability clashes with posts handed down by birth or custom. |
| Partisan institutions (`PARTISAN_INSTITUTIONS`) | Quality assurance (`QUALITY_ASSURANCE`) | Loyalist appointees are rarely held to quality standards. |
| Rule of law (`RULE_OF_LAW`) | Military enforcement (`MILITARY_ENFORCEMENT`) | Order kept by soldiers sidesteps the courts and fair trials. |
| Military enforcement (`MILITARY_ENFORCEMENT`) | Democratic decision making (`DEMOCRATIC_PROCESS`) | Soldiers on the streets undermine free elections. |
| Surveillance system (`SURVEILLANCE_SYSTEM`) | Democratic decision making (`DEMOCRATIC_PROCESS`) | Mass surveillance discourages free debate and voting. |
| Surveillance system (`SURVEILLANCE_SYSTEM`) | Rule of law (`RULE_OF_LAW`) | Mass surveillance oversteps legal protections for privacy. |
| Central economic planning (`PLANNED_ECONOMY`) | Economic incentives (`ECONOMIC_INCENTIVES`) | Fixed state targets leave little room for rewarding initiative. |
| Entrepreneurship support (`ENTREPRENEURSHIP_SUPPORT`) | Central economic planning (`PLANNED_ECONOMY`) | A state-run economy leaves little room for new private businesses. |
| Central economic planning (`PLANNED_ECONOMY`) | Startup incubation (`STARTUP_INCUBATION`) | A state-run economy leaves little room for start-ups. |
| Intellectual property (`INTELLECTUAL_PROPERTY`) | Technology transfer (`TECHNOLOGY_TRANSFER`) | Strict patents make technology harder to share. |

