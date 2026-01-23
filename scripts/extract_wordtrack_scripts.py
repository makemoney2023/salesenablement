#!/usr/bin/env python3
"""
Extract all sales scripts from patch wordtracks and create an Excel document.
"""

import pandas as pd
from pathlib import Path

# Define all patch data extracted from the wordtrack files
patches_data = []

# BOOST PATCH
patches_data.extend([
    # Opening Scripts
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Opening", "Sub-Type": "Cold Approach (Stranger)", 
     "Script": '(Smile genuinely, make eye contact) "Hi there! I couldn\'t help but notice you look like you\'re in need of a little pick-me-up. Happens to the best of us! I\'m [Your Name]. What\'s typically your go-to when you\'re feeling that afternoon slump?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Opening", "Sub-Type": "Warm Introduction (Friend/Family)", 
     "Script": '"Hey [Friend\'s Name]! You know how you\'re always talking about feeling drained by mid-afternoon? I\'ve actually been using something really interesting that\'s made a huge difference for my energy without any caffeine. Have you ever looked into natural ways to boost your vitality without stimulants?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Opening", "Sub-Type": "Social Media DM", 
     "Script": '"Hi [Name]! I saw your post about struggling with energy lately, and I can totally relate – it\'s a common challenge these days. I\'ve found a game-changer for clean, sustained energy that\'s completely drug-free. Would you be open to hearing about a unique approach that\'s helping a lot of people ditch the caffeine crash?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Opening", "Sub-Type": "Referral Introduction", 
     "Script": '"Hi [Prospect Name], this is [Your Name]. [Referral Name] mentioned you recently, and knowing how much you value natural health solutions, they thought you might be interested in what I do. They shared that you\'ve been looking for ways to get more sustained energy without relying on coffee or energy drinks. Is that something you\'re actively exploring right now?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Opening", "Sub-Type": "Event/Party Approach", 
     "Script": '"Oh, I hear you on that! It seems like everyone is looking for ways to keep their energy up these days. I actually work with a really cool, innovative technology that helps the body naturally produce its own clean energy. It\'s completely drug-free. Have you ever heard of \'vibrotactile technology\' for wellness?"'},
    
    # Product Presentation
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Product Presentation", "Sub-Type": "2-Minute Problem-Agitate-Solve", 
     "Script": '''(Problem): "Have you ever found yourself hitting that dreaded afternoon slump, feeling like you need another coffee or an energy drink just to push through? Or maybe you're tired of the jitters and the inevitable crash that comes with those quick fixes? It's a common struggle – trying to keep up with life's demands while feeling constantly drained, often relying on stimulants that eventually leave you feeling worse."

(Agitate): "This isn't just about feeling a bit tired; it impacts everything. Your focus at work slips, your patience with family wears thin, and you might even skip workouts or social plans because you just don't have the energy. And those stimulants? While they offer a temporary boost, they can disrupt your sleep, mess with your digestion, and create a cycle of dependency that's hard to break, ultimately hindering your long-term health and vitality."

(Solve): "That's why I'm so excited about the Super Patch Boost. Imagine getting clean, sustained energy all day long, without any sugar, caffeine, or stimulants. Boost uses revolutionary Vibrotactile Technology – it's a small patch with special patterns that simply touch your skin. These patterns communicate with your body's natural systems, helping it optimize its own neural responses to produce and sustain energy naturally. No pills, no drinks, no crash. Just consistent, natural vitality so you can power through your day, stay focused, and feel your best from morning to night. It's a completely drug-free, non-invasive way to unlock your body's own energy potential."'''},
    
    # Objection Handling
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Objection Handling", "Sub-Type": "It's too expensive", 
     "Script": '"I understand that price is an important factor when you\'re considering new wellness solutions, and you want to ensure you\'re making a wise investment. What aspects are most important for you in a product like this, beyond just the initial cost?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Objection Handling", "Sub-Type": "I need to think about it", 
     "Script": '"I understand this is a significant decision for your health and well-being, and you want to ensure it\'s the right fit for your lifestyle. What specific questions or considerations would be most helpful for you to think through as you evaluate the Boost patch?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Objection Handling", "Sub-Type": "I need to talk to my spouse", 
     "Script": '"I understand this is an important decision, and you want to involve your spouse. What specific questions or concerns do you anticipate your spouse might have, or what information would be most helpful for them to review?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Objection Handling", "Sub-Type": "Does it really work?", 
     "Script": '"I completely understand why you might be skeptical about new technologies, and it\'s important to feel confident in your choices. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Objection Handling", "Sub-Type": "I've tried patches before", 
     "Script": '"I understand you\'ve had experiences with other products in the past that didn\'t deliver the results you hoped for, and that can certainly be frustrating. What types of patches or products were those, and what specifically were you hoping they would achieve for you?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Objection Handling", "Sub-Type": "I'm not interested", 
     "Script": '"I understand you might not be actively looking for a new energy solution right now. Could you share what led you to say you\'re not interested, or what your current approach to energy management looks like?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Objection Handling", "Sub-Type": "I don't have time", 
     "Script": '"I understand you\'re incredibly busy, and time is a precious commodity. What part of exploring a new energy solution feels like it would take up too much of your time, or what are your biggest time commitments right now?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Objection Handling", "Sub-Type": "How is this different from competitor?", 
     "Script": '"I understand you\'re curious about how Boost stands apart from other energy solutions you might be familiar with. What aspects of [competitor] are you most interested in comparing, or what do you like/dislike about that particular product?"'},
    
    # Closing Scripts
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Closing", "Sub-Type": "Assumptive Close", 
     "Script": '"Great! So, based on what we\'ve discussed, it sounds like the Boost patch is exactly what you\'re looking for to get that sustained, clean energy. Let\'s get you started today. What\'s the best shipping address for your first order?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Closing", "Sub-Type": "Alternative Close", 
     "Script": '"To get you started with that clean energy, would you prefer to begin with a 30-day supply to try it out, or would the 90-day pack, which offers better value, be a better fit for you right away?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Closing", "Sub-Type": "Urgency Close", 
     "Script": '"Just so you know, we have a special promotion running this week for new customers, which includes [mention specific benefit, e.g., a bonus product or discount]. This offer ends on Friday, and I\'d love for you to take advantage of it. Does it make sense to get your order placed today so you don\'t miss out?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Closing", "Sub-Type": "Summary Close", 
     "Script": '"So, with Boost, you\'ll finally be able to say goodbye to that afternoon slump, avoid the caffeine jitters, and enjoy sustained, clean energy throughout your day, all thanks to our unique VTT. You\'ll gain improved focus and vitality, without any drugs or side effects. How does getting started with that sound to you?"'},
    {"Patch": "Boost", "Category": "Energy", "Script Type": "Closing", "Sub-Type": "Referral Close", 
     "Script": '"That\'s fantastic! I\'m so excited for you to start experiencing the benefits of Boost. As you begin to feel that sustained energy, who else comes to mind in your network – perhaps a friend, family member, or colleague – who you know is always looking for clean energy solutions or struggling with fatigue like you used to?"'},
])

# DEFEND PATCH
patches_data.extend([
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Opening", "Sub-Type": "Cold Approach (Stranger)", 
     "Script": '"Hi there! I couldn\'t help but notice [something positive/unique about them - e.g., your vibrant energy, that cool [item] you\'re wearing]. I\'m [Your Name], it\'s a pleasure to meet you. I help people discover natural ways to boost their wellness, and your energy just made me think of it. How\'s your day going so far?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Opening", "Sub-Type": "Warm Introduction (Friend/Family)", 
     "Script": '"Hey [Friend\'s Name]! It\'s so good to see you. I was just thinking about you the other day and how you mentioned [previous health concern or goal, e.g., wanting to stay healthy during flu season]. I\'ve recently started using something really exciting that\'s been a game-changer for my own [immune support/wellness], and I immediately thought of you. Do you have a quick moment to hear about it?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Opening", "Sub-Type": "Social Media DM", 
     "Script": '"Hi [Name]! I\'ve been following your posts for a while and always admire [their positive outlook/commitment to fitness/etc.]. I also noticed you\'ve been interested in [related topic like natural health/wellness]. I help people find simple, natural ways to support their immune system, and I thought you might find what I do interesting. Would you be open to learning more, or perhaps just seeing some resources I share?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Opening", "Sub-Type": "Referral Introduction", 
     "Script": '"Hi [Name], my name is [Your Name]. [Referral\'s Name] suggested I reach out to you; they mentioned you were looking for [specific solution, e.g., ways to naturally support your immune system]. They spoke very highly of you! I specialize in helping people find simple, drug-free solutions for their wellness. Would you be open to a quick chat sometime this week to see if I can be of help?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Opening", "Sub-Type": "Event/Party Approach", 
     "Script": '"This is a great party, isn\'t it? I\'m [Your Name]. How do you know [Host\'s Name]? [Listen to their answer, find common ground]. You know, I was just chatting with someone earlier about how challenging it can be to stay healthy, especially with everything going on. What kind of things do you usually do to keep your immune system strong?"'},
    
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Product Presentation", "Sub-Type": "2-Minute Problem-Agitate-Solve", 
     "Script": '''"You know, many people I speak with, like yourself, feel a constant battle to keep their immune system strong. It's often inconvenient to remember daily pills, or you worry about what you're putting into your body. You might feel that even with your best efforts, you're still susceptible to feeling run down, especially during busy or stressful times.

[Problem] This constant worry, or the frustration of catching every little bug, really impacts your energy, your productivity, and frankly, your ability to truly enjoy life with your family and friends. It can leave you feeling vulnerable and drained, rather than vibrant and resilient.

[Agitate] Imagine missing out on important moments, feeling sluggish at work, or just not having the energy for the things you love, all because your immune system isn't getting the consistent, natural support it needs. It's not just about getting sick; it's about the quality of your everyday life.

[Solve] That's exactly why I'm excited to share Defend Super Patch with you. Instead of pills or liquids, Defend uses our unique, patented Vibrotactile Technology. You simply place a small patch on your skin, and its specialized patterns interact with your body's natural systems to trigger a neural response that supports your immune function. It's 100% drug-free, non-invasive, and incredibly simple to use. With Defend, you're giving your body the continuous, natural support it needs to stay strong, vibrant, and resilient, so you can focus on living your best life without constant health worries."'''},
    
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Objection Handling", "Sub-Type": "It's too expensive", 
     "Script": '"I understand that cost is an important factor when you\'re considering new wellness solutions, and you want to make a smart investment in your health. What aspects are most important for you in a product like this, beyond just the initial price?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Objection Handling", "Sub-Type": "I need to think about it", 
     "Script": '"I understand this is a significant decision for your health and well-being, and you want to ensure it\'s the right fit for your lifestyle. What specific questions or considerations are on your mind as you evaluate the Defend patch?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Objection Handling", "Sub-Type": "I need to talk to my spouse", 
     "Script": '"I understand this is an important decision that affects your household, and it\'s great that you involve your spouse in these choices. What specific information or benefits do you think would be most important for your spouse to understand about how Defend could help our family?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Objection Handling", "Sub-Type": "Does it really work?", 
     "Script": '"I completely understand why you might be skeptical about new technologies, and it\'s important to feel confident in your choices. What would you need to see, hear, or experience to truly feel that this is a credible solution for you and your immune health?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Objection Handling", "Sub-Type": "I've tried patches before", 
     "Script": '"I understand you\'ve had experiences with other products in the past, and it\'s natural to wonder if this is different. What was it about those previous solutions that didn\'t quite meet your expectations or left you feeling unsatisfied?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Objection Handling", "Sub-Type": "I'm not interested", 
     "Script": '"I understand you might not be actively looking for a new solution right now, and that\'s perfectly fine. Could you share what makes you feel like this isn\'t a fit for you at this moment?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Objection Handling", "Sub-Type": "I don't have time", 
     "Script": '"I completely understand you have a busy schedule, and your time is valuable. What is it specifically about finding a new immune support solution that feels time-consuming for you right now?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Objection Handling", "Sub-Type": "How is this different from competitor?", 
     "Script": '"I understand you\'re looking for clarity on how Defend stands out, and it\'s smart to compare options. What aspects of [competitor product] are you most familiar with, or what do you like about it, that you\'re looking to compare?"'},
    
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Closing", "Sub-Type": "Assumptive Close", 
     "Script": '"Based on what we\'ve discussed and your desire for [reiterate their key benefit, e.g., consistent immune support without pills], the Defend patch seems like a perfect fit. Shall we get you started with the [recommended package] today so you can begin feeling the difference?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Closing", "Sub-Type": "Alternative Close", 
     "Script": '"So, for your immune support, would you prefer to start with our 30-day supply to try it out, or would our 90-day wellness package, which offers the best value, be a better option for you?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Closing", "Sub-Type": "Urgency Close", 
     "Script": '"Just so you know, our current special offer for the Defend starter kit ends on [Date/Time], and it includes [bonus feature]. If you\'re ready to boost your immune system naturally, now would be the perfect time to take advantage of that. Shall I help you place your order to lock in that saving?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Closing", "Sub-Type": "Summary Close", 
     "Script": '"So, to recap, with Defend, you\'ll be getting a truly innovative, drug-free way to support your immune system, boost your overall wellness, and maintain your health naturally, without the hassle of pills. You mentioned how important [reiterate their key pain point/desire] was to you. Are you ready to move forward and experience these benefits for yourself?"'},
    {"Patch": "Defend", "Category": "Immune Support", "Script Type": "Closing", "Sub-Type": "Referral Close", 
     "Script": '"That\'s fantastic! I\'m so excited for you to start experiencing the benefits of Defend. Who else do you know, perhaps a friend or family member, who might also benefit from natural immune support and wellness, and would appreciate learning about Super Patch?"'},
])

# Continue with remaining patches - I'll add them in a compact format
# FOCUS PATCH
patches_data.extend([
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Opening", "Sub-Type": "Cold Approach (Stranger)", 
     "Script": '"Hi there! I couldn\'t help but notice [something positive/interesting about their outfit, activity, or what they\'re doing]. That\'s really [impressive/cool/unique]! My name is [Your Name], great to meet you." (After initial pleasantries) "I was just thinking about how hard it is for everyone to stay focused these days with so many distractions. Do you ever feel like your brain could use a little extra boost to stay sharp?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Opening", "Sub-Type": "Warm Introduction (Friend/Family)", 
     "Script": '"Hey [Friend\'s Name]! It\'s great to catch up with you. [Mutual Friend] mentioned you\'ve been looking for ways to really boost your productivity lately, and thought of me. How have things been going with that?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Opening", "Sub-Type": "Social Media DM", 
     "Script": '"Hi [Name]! I saw your recent post about [struggle with brain fog/productivity tips] and it really resonated with me. I help people with exactly that challenge, and I immediately thought of you. Would you be open to a quick idea that might make a big difference for you?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Opening", "Sub-Type": "Referral Introduction", 
     "Script": '"Hi [Name]! [Referrer\'s Name] suggested I reach out to you. They mentioned you\'re a real go-getter, always looking for an edge, especially when it comes to staying sharp and focused. Is now a good time for a quick chat about something that could really help?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Opening", "Sub-Type": "Event/Party Approach", 
     "Script": '"This [event/party] is fantastic, isn\'t it? What brings you here tonight? I\'m [Your Name], by the way. I was just chatting with someone about how challenging it is to maintain focus in our busy lives with so much going on. Do you ever find yourself wishing for a bit more mental clarity?"'},
    
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Product Presentation", "Sub-Type": "2-Minute Problem-Agitate-Solve", 
     "Script": '''"Thanks for sharing that, [Customer Name]. It sounds like [reiterate their key pain point, e.g., 'that mid-afternoon brain fog'] is a real challenge for you, and I completely get it.

(Problem) Do you ever find yourself struggling to concentrate, feeling that frustrating brain fog, or getting easily sidetracked when you really need to be sharp and productive?

(Agitate) It's incredibly frustrating, isn't it? That feeling when deadlines loom, or you're trying to study for an important exam, and your mind just won't cooperate. You end up wasting precious time, feeling less accomplished, and sometimes even a bit overwhelmed by the sheer volume of things demanding your attention. And often, the solutions out there either involve caffeine jitters and energy crashes, or they're just not natural, leaving you wondering about long-term effects and what you're actually putting into your body. It can feel like a constant uphill battle just to stay on top of your game.

(Solve) Well, what if there was a simple, elegant, and 100% drug-free way to naturally bolster your mind's concentration and attention? That's exactly what the Super Patch Focus patch is designed to do. It leverages our unique Vibrotactile Technology (VTT) – these specialized ridge patterns on the patch interact with your skin's mechanoreceptors to gently trigger your body's own neural responses, guiding your brain towards better concentration, improved attention, and profound mental clarity. It's like giving your brain a natural 'on' switch, helping you stay sharp and productive without any drugs, chemicals, or invasiveness. You just peel it, stick it on your skin, and start feeling the difference. Imagine tackling your day with that kind of sustained focus!"'''},
    
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Objection Handling", "Sub-Type": "It's too expensive", 
     "Script": '"I understand that money is an important factor when you\'re considering new wellness solutions, and it\'s smart to be mindful of your budget. What other criteria will be used in taking this decision, beyond just the initial cost?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Objection Handling", "Sub-Type": "I need to think about it", 
     "Script": '"I understand this is an important decision for your mental clarity and productivity, and you want to ensure it\'s the right fit for your lifestyle. What specific questions or considerations are on your mind as you think it over?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Objection Handling", "Sub-Type": "I need to talk to my spouse", 
     "Script": '"I understand this is a significant decision for your household and your well-being, and you want to ensure everyone is on board. What aspects of improving your focus and productivity do you think would be most important for your spouse to understand or discuss?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Objection Handling", "Sub-Type": "Does it really work?", 
     "Script": '"I completely understand why you might be skeptical about new technologies, and it\'s important to feel confident in your choices. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Objection Handling", "Sub-Type": "I've tried patches before", 
     "Script": '"I understand you\'ve explored different solutions in the past, and it\'s natural to be cautious when something hasn\'t delivered. What did you like or dislike about those previous patches or products, and what specific results were you hoping for that weren\'t met?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Objection Handling", "Sub-Type": "I'm not interested", 
     "Script": '"I understand you might not be actively looking for something new right now, and that\'s perfectly fine. What aspects of your current focus and productivity are you most satisfied with, or what challenges, if any, do you find yourself just \'living with\'?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Objection Handling", "Sub-Type": "I don't have time", 
     "Script": '"I understand you have a very busy schedule, and that\'s completely fair. What specific challenges around time management or productivity are you facing right now that make it difficult to explore solutions to boost your focus?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Objection Handling", "Sub-Type": "How is this different from competitor?", 
     "Script": '"I understand you\'re looking for the best solution out there, and it\'s smart to compare options. What aspects of [competitor product/caffeine/nootropic] are most appealing to you, and what are you hoping to achieve that might be different or better with a new approach?"'},
    
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Closing", "Sub-Type": "Assumptive Close", 
     "Script": '"Great! So, which subscription package makes the most sense for you to get started with the Focus patches today, the monthly or the quarterly?" OR "Shall we go ahead and get your order placed for the Focus patches so you can start experiencing better concentration this week?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Closing", "Sub-Type": "Alternative Close", 
     "Script": '"Would you prefer to start with a 30-day supply to try it out, or jump straight into the subscription for continuous benefits and savings?" OR "Would you like to pay with your credit card, or would a digital payment method be more convenient?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Closing", "Sub-Type": "Urgency Close", 
     "Script": '"I\'m excited for you to experience this! Just so you know, we\'re actually running a special promotion this week for new customers, which includes a bonus pack of patches. That offer ends on Friday, so if you\'re ready to boost your focus, now would be the perfect time to grab that extra value."'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Closing", "Sub-Type": "Summary Close", 
     "Script": '"So, to recap, with the Super Patch Focus, you\'ll experience better concentration, improved attention, and mental clarity, all delivered through a drug-free, natural, and non-invasive technology. You mentioned how important it is for you to [reiterate their key pain point/goal, e.g., \'stay sharp during long study sessions\']. Given all that, and knowing you\'re ready to tackle those challenges, are you ready to get started and feel the difference?"'},
    {"Patch": "Focus", "Category": "Focus & Attention", "Script Type": "Closing", "Sub-Type": "Next Step Close", 
     "Script": '"I\'m thrilled about the potential for you to improve your focus with these patches. What\'s the best email to send you the direct link to order, so you can easily get started and begin feeling more mentally clear this week?"'},
])

# Save remaining patches to additional data
# FREEDOM PATCH
patches_data.extend([
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Opening", "Sub-Type": "Cold Approach (Stranger)", 
     "Script": '"Hi there! I couldn\'t help but notice your [mention something positive and specific: e.g., \'beautiful garden,\' \'interesting book,\' \'energetic dog\']. That\'s really impressive! My name is [Your Name], by the way. How\'s your day going so far?" (Listen, engage, then transition naturally if appropriate, e.g., "I\'m actually out sharing a simple way people are finding relief from everyday aches, which reminds me, do you ever deal with those minor aches and pains that just pop up?").'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Opening", "Sub-Type": "Warm Introduction (Friend/Family)", 
     "Script": '"Hey [Friend/Family Member\'s Name]! It\'s so good to catch up. How have things been? I was actually thinking about you the other day because I\'ve been helping people with something that I know you\'ve mentioned struggling with – those annoying everyday aches and pains. Is that still something you deal with?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Opening", "Sub-Type": "Social Media DM", 
     "Script": '"Hey [Name]! Loved your recent post about [mention their post]. You always seem so active/busy! I actually help people like you who are constantly on the go, but sometimes find themselves dealing with minor aches and discomfort. Have you ever wished for a natural, drug-free way to just \'turn down the volume\' on those little pains so you can keep doing what you love?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Opening", "Sub-Type": "Referral Introduction", 
     "Script": '"Hi [Prospect\'s Name], my name is [Your Name]. [Referral Name] suggested I reach out to you. They mentioned you might be interested in a natural way to manage some of those everyday aches and pains you\'ve been experiencing. They thought you\'d appreciate how simple and effective it is. How open are you to hearing about something new that could offer some relief?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Opening", "Sub-Type": "Event/Party Approach", 
     "Script": '"This is a great party/event, isn\'t it? My name is [Your Name]. What brings you here tonight? [Listen and engage]. I actually work with a wellness company that\'s helping people find drug-free relief from minor aches and pains. It\'s amazing how many people are looking for natural ways to feel better these days. Do you ever find yourself dealing with those little discomforts that just pop up?"'},
    
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Product Presentation", "Sub-Type": "2-Minute Problem-Agitate-Solve", 
     "Script": '''"You know, it's amazing how those seemingly 'minor' aches and pains can really add up, isn't it? Whether it's a stiff neck from a long day at the computer, sore knees after a walk, or just that general discomfort that makes you feel older than you are, these things can truly chip away at your quality of life. They can stop you from enjoying your hobbies, make it hard to sleep soundly, or even just make simple daily tasks feel like a chore. And often, we just reach for another pill or a messy cream, hoping for relief, but sometimes those solutions come with their own concerns or just don't quite hit the mark.

[Problem] Many people I speak with are just tired of constantly dealing with those nagging aches and pains that interfere with their daily activities – whether it's playing with their grandkids, enjoying a favorite sport, or even just getting a good night's sleep. They're looking for something that really works, without the side effects or the hassle of traditional remedies.

[Agitate] Think about what it truly costs you when you're constantly battling discomfort. It's not just the physical pain; it's the frustration, the reduced energy, the missed moments, and the feeling that you're not living life to its fullest. Relying on pills can bring worries about long-term use, and creams can be messy and temporary. You deserve a solution that empowers your body, not just masks the problem.

[Solve] That's exactly why I'm so excited about the Super Patch Freedom. It's a revolutionary, 100% drug-free, and non-invasive way to take care of those minor aches and pains. You simply apply this small patch to your skin, and its unique Vibrotactile Technology (VTT) gets to work. These specialized patterns interact with your body's natural neural responses to help bring you natural, targeted pain relief. It's not putting anything *into* your body, but rather helping your body help itself. It's discreet, easy to use, and offers a natural pathway to feeling more comfortable and free. Imagine waking up feeling less stiff, enjoying your activities more, and simply living with less discomfort – all naturally.

Do you have any questions for me about how this unique technology works?"'''},
    
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Objection Handling", "Sub-Type": "It's too expensive", 
     "Script": '"I understand that cost is an important consideration when investing in your health, and you want to make a smart decision. Beyond the initial price, what other criteria are most important to you when evaluating a solution like this for your balance and mobility?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Objection Handling", "Sub-Type": "I need to think about it", 
     "Script": '"I understand this is a significant decision for your health and well-being, and you want to ensure it\'s the right fit for your lifestyle. What specific questions or considerations would be most helpful for you to think through as you evaluate the Freedom patch?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Objection Handling", "Sub-Type": "I need to talk to my spouse", 
     "Script": '"I understand this is an important decision, and you want to get everyone involved. What specific questions or concerns do you anticipate your spouse might have that we could address together?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Objection Handling", "Sub-Type": "Does it really work?", 
     "Script": '"I completely understand why you might be skeptical about new technologies, and it\'s important to feel confident in your choices. What would you need to see, hear, or experience to truly feel that this is a credible and effective solution for you?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Objection Handling", "Sub-Type": "I've tried patches before", 
     "Script": '"I understand you\'ve had experiences with other products in the past, and it\'s frustrating when they don\'t deliver. What did you like or dislike about those previous solutions, and what do you feel was missing for you?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Objection Handling", "Sub-Type": "I'm not interested", 
     "Script": '"I understand that you might not be actively looking for a new solution right now, and that\'s perfectly fine. Could you share what specifically about this approach doesn\'t align with what you\'re interested in, or if there\'s any aspect that you\'re curious about, even briefly?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Objection Handling", "Sub-Type": "I don't have time", 
     "Script": '"I understand you have a very busy schedule, and time is precious. If you could find a simple, drug-free way to reduce minor aches and pains, even just a little, how much impact would that have on your ability to manage your time and energy more effectively?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Objection Handling", "Sub-Type": "How is this different from competitor?", 
     "Script": '"I understand you\'re curious about how Freedom stands out, and it\'s smart to compare options. What have you learned or experienced about [competitor] that you find appealing or effective?" (Listen, then explain VTT difference). "Unlike [competitor] which typically delivers a substance, Super Patch Freedom uses Vibrotactile Technology – it\'s a completely drug-free, non-invasive approach that leverages your body\'s own neural responses for relief. It\'s not about what goes *into* your body, but how your body\'s natural systems are activated."'},
    
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Closing", "Sub-Type": "Assumptive Close", 
     "Script": '"Great! Since the Freedom patch aligns with your desire for natural, drug-free relief for those everyday aches, how many boxes should we start you with today so you can experience the difference?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Closing", "Sub-Type": "Alternative Close", 
     "Script": '"Based on what we\'ve discussed, it sounds like the Freedom patch would be a fantastic solution for those knee pains. Would you prefer to start with a single box to try it out, or would the 3-pack be a better value for your ongoing needs?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Closing", "Sub-Type": "Urgency Close", 
     "Script": '"Considering you mentioned those back aches are really impacting your sleep, and we have a special offer on the Freedom patch ending this week, it would be smart to get started now and not miss out on feeling better sooner. Shall I go ahead and process your order for the starter pack today?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Closing", "Sub-Type": "Summary Close", 
     "Script": '"So, to recap, the Freedom patch offers you drug-free, non-invasive relief for those nagging shoulder and neck pains you\'ve been experiencing, allowing you to get back to enjoying your morning walks and sleeping better at night, all through a simple, discreet patch. Given all these benefits and how well it addresses your goals, are you ready to start experiencing the freedom from those aches?"'},
    {"Patch": "Freedom", "Category": "Aches & Pains", "Script Type": "Closing", "Sub-Type": "Referral Close", 
     "Script": '"That\'s fantastic! I\'m so excited for you to experience the relief with Freedom. As you start to feel better, who else do you know – maybe a friend, family member, or colleague – who also struggles with minor aches and pains and would benefit from a natural, drug-free solution like this?"'},
])

# Create the dataframe
df = pd.DataFrame(patches_data)

# Save to Excel
output_path = Path("/Users/cbsuperpatch/Desktop/SalesEnablement/sales_materials/SuperPatch_Sales_Scripts.xlsx")
df.to_excel(output_path, index=False, sheet_name="All Scripts")

print(f"Excel file created at: {output_path}")
print(f"Total scripts extracted: {len(df)}")
