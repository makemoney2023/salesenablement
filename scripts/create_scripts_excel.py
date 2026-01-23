#!/usr/bin/env python3
"""
Create Excel document with all SuperPatch sales scripts extracted from wordtracks.
"""

import pandas as pd
from pathlib import Path

# All scripts data
data = []

# Helper function to add scripts
def add_scripts(patch, category, scripts_dict):
    for script_type, sub_scripts in scripts_dict.items():
        for sub_type, script in sub_scripts.items():
            data.append({
                "Patch Name": patch,
                "Category": category,
                "Script Type": script_type,
                "Sub-Type": sub_type,
                "Script": script
            })

# ============ BOOST ============
add_scripts("Boost", "Energy", {
    "Opening": {
        "Cold Approach": '(Smile genuinely, make eye contact) "Hi there! I couldn\'t help but notice you look like you\'re in need of a little pick-me-up. Happens to the best of us! I\'m [Your Name]. What\'s typically your go-to when you\'re feeling that afternoon slump?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! You know how you\'re always talking about feeling drained by mid-afternoon? I\'ve actually been using something really interesting that\'s made a huge difference for my energy without any caffeine. Have you ever looked into natural ways to boost your vitality without stimulants?"',
        "Social Media DM": '"Hi [Name]! I saw your post about struggling with energy lately, and I can totally relate – it\'s a common challenge these days. I\'ve found a game-changer for clean, sustained energy that\'s completely drug-free. Would you be open to hearing about a unique approach that\'s helping a lot of people ditch the caffeine crash?"',
        "Referral Introduction": '"Hi [Prospect Name], this is [Your Name]. [Referral Name] mentioned you recently, and knowing how much you value natural health solutions, they thought you might be interested in what I do. They shared that you\'ve been looking for ways to get more sustained energy without relying on coffee or energy drinks. Is that something you\'re actively exploring right now?"',
        "Event/Party Approach": '"Oh, I hear you on that! It seems like everyone is looking for ways to keep their energy up these days. I actually work with a really cool, innovative technology that helps the body naturally produce its own clean energy. It\'s completely drug-free. Have you ever heard of \'vibrotactile technology\' for wellness?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''(Problem): "Have you ever found yourself hitting that dreaded afternoon slump, feeling like you need another coffee or an energy drink just to push through? Or maybe you're tired of the jitters and the inevitable crash that comes with those quick fixes?"

(Agitate): "This isn't just about feeling a bit tired; it impacts everything. Your focus at work slips, your patience with family wears thin, and you might even skip workouts or social plans because you just don't have the energy."

(Solve): "That's why I'm so excited about the Super Patch Boost. Imagine getting clean, sustained energy all day long, without any sugar, caffeine, or stimulants. Boost uses revolutionary Vibrotactile Technology – it's a small patch with special patterns that simply touch your skin. These patterns communicate with your body's natural systems, helping it optimize its own neural responses to produce and sustain energy naturally. No pills, no drinks, no crash."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that price is an important factor when you\'re considering new wellness solutions, and you want to ensure you\'re making a wise investment. What aspects are most important for you in a product like this, beyond just the initial cost?"',
        "Need to Think": '"I understand this is a significant decision for your health and well-being, and you want to ensure it\'s the right fit for your lifestyle. What specific questions or considerations would be most helpful for you to think through as you evaluate the Boost patch?"',
        "Talk to Spouse": '"I understand this is an important decision, and you want to involve your spouse. What specific questions or concerns do you anticipate your spouse might have, or what information would be most helpful for them to review?"',
        "Does it Work": '"I completely understand why you might be skeptical about new technologies, and it\'s important to feel confident in your choices. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve had experiences with other products in the past that didn\'t deliver the results you hoped for. What types of patches or products were those, and what specifically were you hoping they would achieve for you?"',
        "Not Interested": '"I understand you might not be actively looking for a new energy solution right now. Could you share what led you to say you\'re not interested, or what your current approach to energy management looks like?"',
        "No Time": '"I understand you\'re incredibly busy, and time is a precious commodity. What part of exploring a new energy solution feels like it would take up too much of your time?"',
        "Competitor Comparison": '"I understand you\'re curious about how Boost stands apart from other energy solutions. What aspects of [competitor] are you most interested in comparing?"'
    },
    "Closing": {
        "Assumptive Close": '"Great! So, based on what we\'ve discussed, it sounds like the Boost patch is exactly what you\'re looking for. Let\'s get you started today. What\'s the best shipping address for your first order?"',
        "Alternative Close": '"Would you prefer to begin with a 30-day supply to try it out, or would the 90-day pack, which offers better value, be a better fit for you right away?"',
        "Urgency Close": '"Just so you know, we have a special promotion running this week for new customers. This offer ends on Friday. Does it make sense to get your order placed today so you don\'t miss out?"',
        "Summary Close": '"So, with Boost, you\'ll finally be able to say goodbye to that afternoon slump, avoid the caffeine jitters, and enjoy sustained, clean energy throughout your day. How does getting started with that sound to you?"',
        "Referral Close": '"That\'s fantastic! As you begin to feel that sustained energy, who else comes to mind in your network who you know is always looking for clean energy solutions?"'
    }
})

# ============ DEFEND ============
add_scripts("Defend", "Immune Support", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice [something positive about them]. I\'m [Your Name], it\'s a pleasure to meet you. I help people discover natural ways to boost their wellness. How\'s your day going so far?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! I was just thinking about you and how you mentioned wanting to stay healthy during flu season. I\'ve recently started using something really exciting that\'s been a game-changer for my own wellness. Do you have a quick moment to hear about it?"',
        "Social Media DM": '"Hi [Name]! I\'ve been following your posts and noticed you\'ve been interested in natural health/wellness. I help people find simple, natural ways to support their immune system. Would you be open to learning more?"',
        "Referral Introduction": '"Hi [Name], my name is [Your Name]. [Referral\'s Name] suggested I reach out to you; they mentioned you were looking for ways to naturally support your immune system. Would you be open to a quick chat?"',
        "Event/Party Approach": '"This is a great party! I was just chatting with someone about how challenging it can be to stay healthy. What kind of things do you usually do to keep your immune system strong?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''[Problem] "Many people feel a constant battle to keep their immune system strong. It's often inconvenient to remember daily pills, or you worry about what you're putting into your body."

[Agitate] "Imagine missing out on important moments, feeling sluggish at work, or not having the energy for the things you love, all because your immune system isn't getting the natural support it needs."

[Solve] "That's why I'm excited about Defend Super Patch. It uses our unique Vibrotactile Technology – you simply place a small patch on your skin, and its specialized patterns interact with your body's natural systems to support your immune function. It's 100% drug-free, non-invasive, and incredibly simple to use."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that cost is an important factor. What aspects are most important for you in a product like this, beyond just the initial price?"',
        "Need to Think": '"I understand this is a significant decision. What specific questions or considerations are on your mind as you evaluate the Defend patch?"',
        "Talk to Spouse": '"I understand this is an important decision that affects your household. What specific information would be most important for your spouse to understand?"',
        "Does it Work": '"I completely understand why you might be skeptical. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve had experiences with other products. What was it about those previous solutions that didn\'t meet your expectations?"',
        "Not Interested": '"I understand you might not be looking for a new solution right now. Could you share what makes you feel like this isn\'t a fit?"',
        "No Time": '"I completely understand you have a busy schedule. What is it specifically about finding a new immune support solution that feels time-consuming?"',
        "Competitor Comparison": '"I understand you\'re looking for clarity on how Defend stands out. What aspects of [competitor] are you most familiar with?"'
    },
    "Closing": {
        "Assumptive Close": '"Based on what we\'ve discussed, the Defend patch seems like a perfect fit. Shall we get you started with the [recommended package] today?"',
        "Alternative Close": '"Would you prefer to start with our 30-day supply to try it out, or would our 90-day wellness package be a better option for you?"',
        "Urgency Close": '"Our current special offer ends on [Date/Time]. If you\'re ready to boost your immune system naturally, now would be the perfect time. Shall I help you place your order?"',
        "Summary Close": '"With Defend, you\'ll be getting a truly innovative, drug-free way to support your immune system. Are you ready to move forward and experience these benefits?"',
        "Referral Close": '"Who else do you know who might also benefit from natural immune support and wellness?"'
    }
})

# ============ FOCUS ============
add_scripts("Focus", "Focus & Attention", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice [something positive about them]. My name is [Your Name]. I was just thinking about how hard it is for everyone to stay focused these days. Do you ever feel like your brain could use a little extra boost?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! [Mutual Friend] mentioned you\'ve been looking for ways to boost your productivity lately. How have things been going with that?"',
        "Social Media DM": '"Hi [Name]! I saw your recent post about [productivity/brain fog] and it really resonated with me. Would you be open to a quick idea that might make a big difference for you?"',
        "Referral Introduction": '"Hi [Name]! [Referrer\'s Name] suggested I reach out. They mentioned you\'re always looking for an edge when it comes to staying sharp and focused. Is now a good time for a quick chat?"',
        "Event/Party Approach": '"This event is fantastic! I was just chatting with someone about how challenging it is to maintain focus in our busy lives. Do you ever find yourself wishing for a bit more mental clarity?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''(Problem) "Do you ever find yourself struggling to concentrate, feeling that frustrating brain fog, or getting easily sidetracked when you really need to be sharp?"

(Agitate) "It's incredibly frustrating when deadlines loom, or you're trying to study for an exam, and your mind just won't cooperate. You end up wasting precious time, feeling less accomplished."

(Solve) "The Super Patch Focus uses Vibrotactile Technology – specialized patterns that interact with your skin to gently trigger your body's own neural responses, guiding your brain towards better concentration, improved attention, and mental clarity. It's drug-free, natural, and non-invasive."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that money is an important factor. What other criteria will be used in taking this decision, beyond just the initial cost?"',
        "Need to Think": '"I understand this is an important decision. What specific questions or considerations are on your mind as you think it over?"',
        "Talk to Spouse": '"I understand this is a significant decision. What aspects of improving your focus would be most important for your spouse to understand?"',
        "Does it Work": '"I completely understand why you might be skeptical. What would you need to see, hear, or experience to feel confident this is a credible solution?"',
        "Tried Before": '"I understand you\'ve explored different solutions. What did you like or dislike about those previous products, and what results were you hoping for?"',
        "Not Interested": '"I understand you might not be looking for something new. What aspects of your current focus and productivity are you most satisfied with?"',
        "No Time": '"I understand you have a very busy schedule. What specific challenges around time management or productivity are you facing?"',
        "Competitor Comparison": '"I understand you\'re looking for the best solution. What aspects of [competitor] are most appealing to you?"'
    },
    "Closing": {
        "Assumptive Close": '"Great! Which subscription package makes the most sense for you to get started with the Focus patches today?"',
        "Alternative Close": '"Would you prefer to start with a 30-day supply to try it out, or jump straight into the subscription for continuous benefits?"',
        "Urgency Close": '"We\'re running a special promotion this week for new customers. That offer ends on Friday. Now would be the perfect time to grab that extra value."',
        "Summary Close": '"With Super Patch Focus, you\'ll experience better concentration, improved attention, and mental clarity. Are you ready to get started and feel the difference?"',
        "Next Step Close": '"What\'s the best email to send you the direct link to order, so you can easily get started this week?"'
    }
})

# ============ FREEDOM ============
add_scripts("Freedom", "Aches & Pains", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice your [positive observation]. My name is [Your Name]. I\'m actually out sharing a simple way people are finding relief from everyday aches. Do you ever deal with those minor aches and pains?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! I was actually thinking about you because I\'ve been helping people with something I know you\'ve mentioned – those annoying everyday aches and pains. Is that still something you deal with?"',
        "Social Media DM": '"Hey [Name]! You always seem so active! I help people who are constantly on the go but deal with minor aches. Have you ever wished for a natural, drug-free way to just \'turn down the volume\' on those little pains?"',
        "Referral Introduction": '"Hi [Prospect\'s Name], [Referral Name] suggested I reach out. They mentioned you might be interested in a natural way to manage everyday aches and pains. How open are you to hearing about something new?"',
        "Event/Party Approach": '"This is a great event! I actually work with a wellness company helping people find drug-free relief from minor aches and pains. Do you ever find yourself dealing with those little discomforts?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''[Problem] "Many people are tired of constantly dealing with nagging aches and pains that interfere with their daily activities – playing with grandkids, enjoying hobbies, or getting a good night's sleep."

[Agitate] "Think about what it truly costs you when you're constantly battling discomfort. It's not just the physical pain; it's the frustration, the missed moments, and the feeling that you're not living life to its fullest."

[Solve] "That's exactly why I'm excited about Super Patch Freedom. It's a revolutionary, 100% drug-free, non-invasive way to take care of those minor aches and pains. Its unique Vibrotactile Technology interacts with your body's natural neural responses to help bring you natural, targeted pain relief."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that cost is an important consideration. What other criteria are most important to you when evaluating a solution for your aches?"',
        "Need to Think": '"I understand this is a significant decision. What specific questions or considerations would be most helpful for you to think through?"',
        "Talk to Spouse": '"I understand this is an important decision. What specific questions do you anticipate your spouse might have that we could address together?"',
        "Does it Work": '"I completely understand why you might be skeptical. What would you need to see, hear, or experience to truly feel this is a credible solution?"',
        "Tried Before": '"I understand you\'ve had experiences with other products. What did you like or dislike about those, and what do you feel was missing?"',
        "Not Interested": '"I understand you might not be looking for a new solution. Could you share what specifically doesn\'t align with what you\'re interested in?"',
        "No Time": '"I understand you have a very busy schedule. If you could find a simple, drug-free way to reduce aches, how much impact would that have on your life?"',
        "Competitor Comparison": '"Unlike [competitor] which typically delivers a substance, Freedom uses Vibrotactile Technology – a completely drug-free approach that leverages your body\'s own neural responses for relief."'
    },
    "Closing": {
        "Assumptive Close": '"Great! Since Freedom aligns with your desire for natural, drug-free relief, how many boxes should we start you with today?"',
        "Alternative Close": '"Would you prefer to start with a single box to try it out, or would the 3-pack be a better value for your ongoing needs?"',
        "Urgency Close": '"We have a special offer on Freedom ending this week. It would be smart to get started now. Shall I process your order for the starter pack today?"',
        "Summary Close": '"The Freedom patch offers drug-free, non-invasive relief for those nagging pains, allowing you to get back to enjoying your activities. Are you ready to start experiencing the freedom from those aches?"',
        "Referral Close": '"As you start to feel better, who else do you know who struggles with minor aches and would benefit from a natural, drug-free solution?"'
    }
})

# ============ IGNITE ============
add_scripts("Ignite", "Max RMR", {
    "Opening": {
        "Cold Approach": '"Excuse me, I couldn\'t help but notice your [cool item]. My name is [Your Name], it\'s great to meet you! What brings you out today?" (Then transition) "I help people feel more energetic and get their metabolism firing naturally."',
        "Warm Introduction": '"Hey [Friend\'s Name]! I was actually thinking about you because you mentioned you were [feeling sluggish/trying to get back into shape]. I recently started using something that\'s been a game-changer for my own metabolism and energy. Would you be open to hearing about it?"',
        "Social Media DM": '"Hey [Name]! Loved your recent post about [fitness/energy]. It really resonated with me. I\'ve found something truly innovative that\'s been helping me naturally boost my metabolism and energy. Would you be open to a quick chat about it?"',
        "Referral Introduction": '"Hi [Prospect\'s Name], my name is [Your Name]. [Referrer\'s Name] suggested I reach out. They mentioned you might be interested in boosting your metabolism or finding natural ways to manage your weight. Would now be a good time for a quick chat?"',
        "Event/Party Approach": '"It\'s a great party! I actually help people feel more energetic and get their metabolism firing naturally. Have you ever felt like your metabolism could use a little boost?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''(Problem & Agitate) "Many people feel exactly like you do. They're doing their best, eating well, maybe even working out, but they still struggle with feeling sluggish, hitting a weight loss plateau, or wishing their metabolism was more efficient. It can really impact your energy, your confidence, and how you feel about yourself every day."

(Solve) "That's exactly why I'm so excited about the Super Patch Ignite. Imagine a way to naturally 'fire up your metabolism' and help your body 'burn calories even while at rest' – all without pills, stimulants, or anything invasive. Ignite uses Vibrotactile Technology – specialized ridge patterns that interact with your skin to signal your body's own neural responses to naturally boost your metabolism and support calorie burning."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that price is an important factor. What other criteria are most important for you in a product like this, beyond just the initial cost?"',
        "Need to Think": '"I completely understand this is an important decision. What specific questions or considerations are on your mind that you need to think about further?"',
        "Talk to Spouse": '"I understand this is a significant decision. What aspects of Ignite do you think they\'d be most interested in discussing, or what concerns might they have?"',
        "Does it Work": '"I completely understand why you\'d want to be sure it truly delivers results. What would you need to see, hear, or experience to truly feel confident this is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve tried other things in the past. What was your experience with those, and what makes you hesitant about trying something new like Ignite?"',
        "Not Interested": '"I understand you might not be actively looking for new solutions right now. Is there anything specific that makes you feel it\'s not a fit?"',
        "No Time": '"I completely understand you have a very busy schedule! If Ignite could help you feel more energetic and efficient, how much of a priority would finding a few moments to discuss it be?"',
        "Competitor Comparison": '"What have you heard or experienced about [competitor] that you\'re comparing it to, and what specifically are you looking for in a solution?"'
    },
    "Closing": {
        "Assumptive Close": '"Based on everything we\'ve discussed and your goal to [boost your metabolism], the Ignite patch sounds like the perfect fit. Are we ready to get you started with a 30-day supply today?"',
        "Alternative Close": '"Would you prefer to start with our popular 30-day supply, or would the 90-day package that offers even better value be a better option for you today?"',
        "Urgency Close": '"Just so you know, our special introductory offer, which includes [bonus/discount], is ending this week. Shall we get your order placed?"',
        "Summary Close": '"With Ignite, you\'ll be naturally boosting your metabolism, supporting calorie burning even at rest. You mentioned how important [feeling more energetic] is to you. Are you ready to experience the power of Ignite?"',
        "Referral Close": '"Who else do you know who might be looking to boost their metabolism, manage their weight, or just feel more energetic naturally?"'
    }
})

# ============ JOY ============
add_scripts("Joy", "Mood", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice your [interesting item]. My name is [Your Name], it\'s great to meet you. I\'m curious, how do you usually keep your spirits up with such a busy schedule?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! How have you been? I was thinking about you and wanted to share something I\'m really excited about. Have you ever looked into natural ways to boost your emotional state?"',
        "Social Media DM": '"Hi [Name]! I\'ve been following your posts and appreciate your [positive attribute]. I saw your story about [feeling overwhelmed/seeking balance] and it resonated with me. Would you be open to learning about a natural wellness technology that\'s helping people enhance their mood?"',
        "Referral Introduction": '"Hi [Name]! My name is [Your Name], and [Mutual Friend] suggested I connect with you. She mentioned you really value natural health solutions. How open are you to exploring new ways to support your mood?"',
        "Event/Party Approach": '"What a great party! My name\'s [Your Name]. I was just chatting about how important it is to stay positive these days. What are your go-to strategies for keeping a positive mindset?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''[PROBLEM] "In today's fast-paced world, it's incredibly common to feel overwhelmed, stressed, or just a bit 'off' emotionally. We're constantly bombarded, and it can be really tough to maintain that sense of inner calm and positive outlook."

[AGITATE] "When our mood dips, it doesn't just affect us; it spills over into our relationships, our work, and our ability to enjoy the simple things in life. It can leave us feeling drained, unmotivated, and searching for answers."

[SOLVE] "That's exactly why I'm excited about the Super Patch Joy. Imagine a natural, drug-free, and incredibly simple way to tap into your body's own ability to feel happier and more balanced. The Joy patch uses Vibrotactile Technology – a specialized pattern that interacts with your skin, sending a signal to your brain to naturally enhance your mood, promote emotional well-being, and give you a more positive outlook."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that price is an important factor. What other criteria are most important for you in a product like this, beyond just the initial cost?"',
        "Need to Think": '"I completely understand that this is a significant decision. What specific questions or considerations are on your mind that you\'d like to think through?"',
        "Talk to Spouse": '"I understand this is an important decision. What specific questions or concerns do you anticipate your spouse might have that we could address now?"',
        "Does it Work": '"I totally get why you might be skeptical. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve explored other options. What did you like or dislike about those previous products, and what were you truly hoping for when you tried them?"',
        "Not Interested": '"I understand you might feel your current approach to well-being is working well. What aspects of your current routine for emotional balance are you most satisfied with?"',
        "No Time": '"I completely understand your schedule is packed. What\'s the biggest priority for you right now when it comes to your personal well-being?"',
        "Competitor Comparison": '"That\'s a great question. What have you learned about [competitor] that you find appealing, and what are you hoping for in a solution that you might not be getting from other options?"'
    },
    "Closing": {
        "Assumptive Close": '"Great! So, which Super Patch Joy package would you like to start with today to begin experiencing those mood-boosting benefits?"',
        "Alternative Close": '"Would you prefer to start with a monthly subscription for continuous support and savings, or a one-time purchase to try it out first?"',
        "Urgency Close": '"We have a special \'New Customer Joy Pack\' promotion ending this Friday. This is a great way to maximize your benefits right from the start. Is that something you\'d like to take advantage of today?"',
        "Summary Close": '"Based on what we\'ve discussed, Joy will help you manage daily stress, maintain a more positive outlook, and feel more emotionally balanced, all naturally. Does that sound like what you\'re looking for? Shall we get you started?"',
        "Referral Close": '"Knowing what you know now about Joy, if you were to recommend this to someone you care about, what would you tell them? Are you ready to experience that for yourself?"'
    }
})

# ============ KICK IT ============
add_scripts("Kick It", "Willpower", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice [something positive about them]. My name is [Your Name]. I actually help people boost their natural willpower to overcome things like cravings and bad habits. What brings you out today?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! How have you been? You know how much I care about your well-being. I\'ve started working with something incredible that I think could really help you with [achieve some goals]. It\'s called Kick It. Would you like to hear about it?"',
        "Social Media DM": '"Hi [Name], I\'ve been following your journey and really admire your [dedication/positive mindset]. I help people discover a natural way to enhance their willpower and break free from challenging habits. Would you be open to learning about a drug-free patch that could support your goals?"',
        "Referral Introduction": '"Hi [Prospect\'s Name], my name is [Your Name]. [Referral\'s Name] suggested I reach out. They mentioned you might be interested in a natural way to boost your willpower and tackle some persistent habits. Would you be open to a quick chat?"',
        "Event/Party Approach": '"What a great event! I spend my time helping people naturally strengthen their willpower to overcome bad habits. Have you ever thought about how much easier life would be with a little more natural self-control?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''(Problem) "We all know how frustrating it can be to try and break a bad habit. You set a goal, you're motivated, but then those intense cravings hit, and suddenly, you're right back where you started. It feels like a constant battle against your own willpower."

(Agitate) "Think about the cycle: the guilt, the disappointment, the health consequences, the money spent on things you're trying to quit. It's exhausting, and it makes you question if you'll ever truly gain control. It's not just about the habit itself, it's about the feeling of losing control over your own choices."

(Solve) "That's exactly why I'm so excited about the Super Patch Kick It. Imagine having natural, consistent support for your willpower, without any drugs. Kick It uses Vibrotactile Technology – specialized patterns that communicate with your body's nervous system, triggering natural responses to enhance self-control and reduce cravings. It's 100% drug-free, all-natural, and incredibly simple to use."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that money is an important factor. What other criteria are most important for you in making this decision, beyond just the initial cost?"',
        "Need to Think": '"I understand this is a significant decision. What specific questions or considerations would be most helpful for you to think through as you evaluate Kick It?"',
        "Talk to Spouse": '"I understand this is an important decision. What specific questions or concerns do you anticipate they might have, or what information would be most helpful for them?"',
        "Does it Work": '"I completely understand why you might be skeptical. What would you need to see, hear, or experience to truly feel that this is a credible solution to support your willpower?"',
        "Tried Before": '"I understand you\'ve had experiences with other products. Can you tell me what you liked or disliked about those experiences, and what you felt was missing?"',
        "Not Interested": '"I understand you might not be looking for something new right now. Could you share what makes you say you\'re not interested at this moment?"',
        "No Time": '"I understand you have a very busy schedule. What are your biggest priorities right now when it comes to personal health, and how does overcoming this habit fit in?"',
        "Competitor Comparison": '"That\'s a great question. What have you heard or experienced about [competitor], and what are you hoping for in a solution that makes it stand out?"'
    },
    "Closing": {
        "Assumptive Close": '"Fantastic! Based on everything we\'ve discussed and your goal to [quit smoking/break the habit], it sounds like Kick It is exactly what you need. Which package makes the most sense for you to get started today?"',
        "Alternative Close": '"Would you prefer to start with our 30-day supply to try it out, or our 90-day package for the best value and sustained support?"',
        "Urgency Close": '"We have a special promotion ending this week that includes [bonus/discount]. What\'s the best way to get this ordered for you so you can start seeing results?"',
        "Summary Close": '"With Kick It, you\'ll be getting natural willpower support, a drug-free way to reduce cravings, and a simple method to finally take control of [specific habit]. This means more confidence, better health, and true freedom. Doesn\'t that sound like what you\'re looking for?"',
        "Referral Close": '"Who else do you know who might be struggling with a habit or could benefit from natural willpower support? I\'d love to help them too."'
    }
})

# ============ LIBERTY ============
add_scripts("Liberty", "Mobility", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice your [active wear/energetic pace]. My name is [Your Name], and I specialize in helping people enhance their natural balance and mobility. Have you ever really thought about how important your balance is to your daily life?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! It\'s so good to catch up! I\'ve been really excited about something that\'s making a huge difference for people, and I immediately thought of you because of your [interest in health/active lifestyle]. Are you open to hearing about a natural, drug-free way to boost your balance and mobility?"',
        "Social Media DM": '"Hi [Name]! I\'ve been following your [fitness journey/healthy living posts] and I\'m genuinely impressed! I help people optimize their natural balance and mobility. Would you be open to a quick chat to see if it\'s a good fit?"',
        "Referral Introduction": '"Hi [Prospect Name], my name is [Your Name]. [Referral Name] suggested I reach out. They mentioned you were looking for ways to improve your balance or stay active. I work with a natural, non-invasive technology that helps with balance and mobility. Are you free for a brief call?"',
        "Event/Party Approach": '"Hey [Name], enjoying the event? I actually help people improve their balance and mobility naturally. Have you ever thought about how important your balance is to your daily life?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''(Problem) "Many people, especially as they age or push their bodies in sports, start to notice little wobbles, a bit less confidence in their steps, or even a fear of falling. It can really limit what you feel comfortable doing."

(Agitate) "Think about what that feeling of unsteadiness does to your daily life. It might mean you avoid certain activities, rely more on others, or constantly worry about taking a tumble. That loss of independence can be incredibly frustrating."

(Solve) "That's why I'm excited about the Liberty Super Patch. It's a completely natural, drug-free, non-invasive way to tap into your body's own ability to improve balance and mobility. Using Vibrotactile Technology, the Liberty patch interacts with your skin's mechanoreceptors, sending signals to your brain to enhance your natural stability."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that cost is an important consideration. Beyond the initial price, what other criteria are most important to you when evaluating a solution for your balance and mobility?"',
        "Need to Think": '"I understand this is a significant decision. What specific aspects are you hoping to think more deeply about?"',
        "Talk to Spouse": '"I understand you want to involve your spouse. What specific information would be most important for them to understand about how Liberty could help?"',
        "Does it Work": '"I completely understand why you might be skeptical. What would you need to see, hear, or experience to truly feel that this is a credible solution for your balance and mobility?"',
        "Tried Before": '"I understand you\'ve explored other solutions. Can you tell me about what you\'ve tried and what your experience was?"',
        "Not Interested": '"I understand you might not be looking for new solutions. Could you share what led you to that feeling, or what your current approach to maintaining your balance looks like?"',
        "No Time": '"I understand you have a very busy schedule. What would an ideal solution look like that could easily fit into your current routine?"',
        "Competitor Comparison": '"What have you learned about [competitor] that you find appealing, and what are you hoping to achieve that it might not be addressing?"'
    },
    "Closing": {
        "Assumptive Close": '"So, based on everything we\'ve discussed – how Liberty can help you improve your balance and get back to doing the activities you love – it sounds like this is exactly what you\'re looking for. What\'s the best address to send your first order to?"',
        "Alternative Close": '"Would you prefer to start with a 30-day supply to experience the initial benefits, or are you ready to commit to the 90-day package for the best value?"',
        "Urgency Close": '"With our current special promotion ending this week, now is truly the best time to start. How about we get you set up today?"',
        "Summary Close": '"We\'ve talked about how Liberty can help improve your balance, enhance your stability, boost your confidence in your movements, and get back to doing the activities you love. Are you ready to move forward and experience the difference?"',
        "Trial Close": '"Based on what we\'ve discussed, if you could start experiencing improved balance and more confident movement right away, would that be something you\'d be excited about?"'
    }
})

# ============ LUMI ============
add_scripts("Lumi", "Beauty", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice your [positive energy/style]. I\'m [Your Name]. I actually work with a really cool wellness technology that helps people boost their natural radiance and skin appearance. If you\'re open to it, I\'d love to share more sometime."',
        "Warm Introduction": '"Hey [Friend\'s Name]! How have you been? I\'ve been really excited about something new that I genuinely think could be a game-changer for you, especially knowing how much you care about natural health. It\'s a non-invasive way to support your skin\'s natural radiance. Are you open to hearing about it?"',
        "Social Media DM": '"Hi [Name]! I really admire your [commitment to wellness/healthy lifestyle]. I work with a unique beauty technology called Lumi that helps people enhance their natural skin radiance. It\'s 100% natural and drug-free. Would you be open to a quick chat?"',
        "Referral Introduction": '"Hi [Name], my name is [Your Name]. [Referral Source] suggested I reach out; they mentioned you\'re someone who really values natural wellness and a healthy lifestyle. I\'m introducing people to Lumi, a revolutionary patch that uses your body\'s own signals to support radiant skin. Are you free for a quick call?"',
        "Event/Party Approach": '"What a great event! I\'m [Your Name]. I help people tap into their body\'s natural ability to achieve healthier, more radiant skin, completely non-invasively. Have you ever explored solutions that work *with* your body for beauty support?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''(Problem): "Many people are looking for that natural, healthy glow, but they're often frustrated. They've tried countless creams, serums, and supplements, only to find their skin still looks dull, uneven, or not as vibrant as they'd like."

(Agitate): "It's disheartening when you invest time and money into products that don't deliver. That feeling of looking in the mirror and not seeing the radiant skin you want can really impact your confidence."

(Solve): "That's exactly why I'm excited about Lumi. Instead of putting things on or in your body, Lumi uses Vibrotactile Technology – specialized patterns that gently interact with your skin to naturally trigger your body's own neural responses for beauty support. It's 100% drug-free, all-natural, and non-invasive. Think of it as activating your body's inherent intelligence for beauty."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that cost is an important factor. What other criteria are most important for you when evaluating the value of a product that supports your skin\'s health?"',
        "Need to Think": '"I completely understand. What specific questions or considerations are coming up for you as you think it over that I might be able to help clarify?"',
        "Talk to Spouse": '"I understand this is a significant decision. What specific questions or concerns do you anticipate your spouse might have that we could address together?"',
        "Does it Work": '"I completely understand why you might be skeptical. What would you need to see, hear, or experience to truly feel that Lumi is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve had experiences with other products. What did you like or dislike about those, and what were you hoping they would achieve for your skin?"',
        "Not Interested": '"I understand you might not be actively looking for new solutions. Just out of curiosity, what has led you to feel that way about beauty and wellness products?"',
        "No Time": '"I completely understand, life can get busy. What aspects of your current skincare routine do you find most time-consuming, and what kind of time commitment would make a new solution appealing?"',
        "Competitor Comparison": '"What have you found most appealing or effective about [competitor/topical cream], and what are you hoping to find that it might not be providing?"'
    },
    "Closing": {
        "Assumptive Close": '"Great! It sounds like Lumi patches are exactly what you\'ve been looking for to enhance your natural radiance. Which package would you like to start with today?"',
        "Alternative Close": '"Considering your desire for more radiant skin with a natural approach, would you prefer to get started with our 30-day supply, or would the 90-day package be a better fit?"',
        "Urgency Close": '"Right now, we have a special offer for new customers that includes [bonus/discount] if you get started this week. Shall we go ahead and secure that for you today?"',
        "Summary Close": '"We\'ve talked about how Lumi can help you achieve that radiant complexion, support your skin\'s appearance, and integrate seamlessly into your healthy lifestyle. You mentioned how important [their key desire] is to you. Given all of that, are you ready to start experiencing the Lumi difference?"',
        "Comfort Close": '"Based on everything we\'ve discussed, how comfortable are you with moving forward and giving this a try?"'
    }
})

# ============ PEACE ============
add_scripts("Peace", "Stress", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice your [cool item/book]. My name is [Your Name]. I was thinking, a lot of people I meet are always looking for ways to feel a little more centered amidst the daily hustle. Have you ever felt like you could use a secret weapon for calm?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! How have things been? I was actually thinking about you because you mentioned how [busy/stressed] you\'ve been lately. I\'ve discovered something really incredible that I think could genuinely help you feel a lot more relaxed and clear-headed. Are you open to hearing about it?"',
        "Social Media DM": '"Hi [Name], I\'ve been following your posts and really admire how you [juggle work and family/always share positive vibes]. I recently started using something that has been a game-changer for my own stress levels. It\'s called the Peace Super Patch, and it\'s completely natural and non-invasive. Would you be open to a quick chat?"',
        "Referral Introduction": '"Hi [Name], my name is [Your Name]. [Referral Name] suggested I reach out. They mentioned you were looking for a natural way to manage stress. I help people find calm and clarity naturally. Are you free for a quick call this week?"',
        "Event/Party Approach": '"It\'s been great chatting with you! I was thinking about how easy it is to feel drained with everything going on in life. What do you do to keep yourself feeling balanced and calm when things get hectic?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''[PROBLEM] "In today's fast-paced world, the problem is that stress has become a constant companion for so many of us. We're juggling responsibilities, battling information overload, and often find ourselves feeling perpetually on edge."

[AGITATE] "When that stress isn't managed, it really agitates our entire system. It drains our energy, makes us irritable, clouds our judgment, and can even take a toll on our physical health. It leaves us feeling drained and unable to fully enjoy the moments that matter most."

[SOLVE] "That's where the Peace Super Patch comes in. Imagine having a simple, natural way to tap into your body's own ability to find calm. Peace uses Vibrotactile Technology – a small, discreet patch with specialized patterns that interact with your skin. This gentle interaction sends signals to your brain, helping to guide your body into a state of deep relaxation and mental clarity. It's 100% drug-free, non-invasive, and incredibly easy to use."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that price is an important factor. What other criteria will be most important for you in making this decision, beyond just the initial cost?"',
        "Need to Think": '"I understand this is a significant decision. What specific questions or considerations would be most helpful for you to think through as you evaluate the Peace patch?"',
        "Talk to Spouse": '"I understand this is an important decision. What specific questions or concerns do you anticipate they might have, or what information would be most helpful for you to discuss with them?"',
        "Does it Work": '"I completely understand why you might be skeptical. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve explored other options. What was your experience with those products, and what were you hoping they would achieve that they didn\'t?"',
        "Not Interested": '"I understand you might not be actively looking. What, if anything, has held you back from addressing stress in the past?"',
        "No Time": '"I understand your schedule is busy. What\'s the biggest impact unmanaged stress has on your ability to manage your time effectively?"',
        "Competitor Comparison": '"What aspects of [competitor/other product] are most appealing to you, and what are you hoping for that might be different or more effective?"'
    },
    "Closing": {
        "Assumptive Close": '"Great! Since the Peace patch directly addresses your need for [better sleep and less overwhelm], what quantity would you like to start with?"',
        "Alternative Close": '"To get started on your journey to greater calm, would you prefer to begin with a 30-day supply, or would the 90-day bundle be a better fit?"',
        "Urgency Close": '"Our current promotion for [free shipping/special offer] ends this Friday. If you\'re ready to start experiencing more calm and clarity, now would be the perfect time. Shall we get your order placed today?"',
        "Summary Close": '"With the Peace patch, you\'ll be able to reduce your daily stress, improve your focus, and finally get that restful sleep you\'ve been craving, all without drugs or side effects. Are you ready to start feeling more peaceful and clear-headed?"',
        "Referral Close": '"As you think about how this will help you, who else in your life – a friend, family member, or colleague – could really benefit from managing their stress and finding more peace?"'
    }
})

# ============ REM ============
add_scripts("REM", "Sleep", {
    "Opening": {
        "Cold Approach": '"Excuse me, I couldn\'t help but notice your [interesting item]. My name is [Your Name]. I\'m actually out sharing information on natural ways to boost well-being. Have you ever thought about how much good sleep can impact your day?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! How have you been? The other day when we were talking about how exhausted you\'ve been feeling, it really stuck with me. I\'ve actually started using something revolutionary that has completely changed my sleep. Are you open to hearing about a natural way to finally get that deep, restorative sleep?"',
        "Social Media DM": '"Hi [Name], I saw your comment on [relevant post/your recent story about feeling tired], and it really resonated with me. So many people are struggling with sleep! I\'m a wellness advocate with Super Patch, and we have an incredible drug-free solution called REM that\'s helping people finally get the deep, restorative sleep they need. Would you be open to a quick chat?"',
        "Referral Introduction": '"Hi [New Contact\'s Name], my name is [Your Name], and [Referrer\'s Name] suggested I reach out. They mentioned you\'ve been looking into natural ways to improve your sleep. [Referrer\'s Name] had a great experience with our REM Super Patch. I\'d love to share how it works. Would you be free for a brief call?"',
        "Event/Party Approach": '"Hi [Name], great party! I\'m [Your Name]. What brings you here today? I\'m always fascinated by how people manage their energy levels. I actually help people unlock better sleep and energy through a natural technology called Super Patch. Have you ever explored drug-free options for truly restorative sleep?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''(Problem) "For too long, we've accepted that waking up tired, feeling groggy, or struggling to fall asleep is just 'part of life.' We try everything – counting sheep, cutting caffeine, even relying on pills – but the fundamental problem remains: our bodies aren't getting into that deep, restorative sleep state."

(Agitate) "When we don't get that deep sleep, it doesn't just make us tired; it impacts everything. Our mood suffers, our focus declines, we feel more stressed, and our immune system can even take a hit. It's a vicious cycle that leaves us feeling constantly drained."

(Solve) "That's why I'm excited about the Super Patch REM. Imagine a solution that works *with* your body, naturally, without drugs or side effects. The REM patch uses Vibrotactile Technology – a unique pattern that interacts with your skin to gently trigger your body's neural responses, guiding your brain into those deeper, more regenerative sleep cycles. It's 100% drug-free, non-invasive, and all-natural."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that price is an important factor when considering new wellness solutions. What aspects are most important for you in a product like this, beyond just the initial cost?"',
        "Need to Think": '"I understand this is a significant decision. What specific questions or considerations would be most helpful for you to think through as you evaluate the Super Patch?"',
        "Talk to Spouse": '"I understand this is a decision that often involves your partner. When you speak with your spouse, what key information or concerns do you anticipate they might have?"',
        "Does it Work": '"I completely understand why you might be skeptical about new technologies. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve had experiences with other products that haven\'t delivered. What specifically did you try, and what was it about those solutions that didn\'t meet your expectations?"',
        "Not Interested": '"I understand you might not be looking for something new. When it comes to getting a good night\'s sleep, what\'s currently working well for you, or what\'s your biggest challenge?"',
        "No Time": '"I completely understand, life is incredibly busy, especially when you\'re not sleeping well. What part of your day typically feels most impacted by your current energy levels?"',
        "Competitor Comparison": '"What have you experienced with [competitor] so far, and what are you hoping to achieve with a new solution?"'
    },
    "Closing": {
        "Assumptive Close": '"Great! Based on everything we\'ve discussed, it sounds like the REM patch is exactly what you need to finally get that deep, restorative sleep. What\'s the best address to send your first month\'s supply to?"',
        "Alternative Close": '"Given how important it is for you to wake up refreshed, would you prefer to start with a 30-day supply to try it out, or would the 90-day package be a better fit for you today?"',
        "Urgency Close": '"Our current special, where you get [X benefit/discount], ends this Friday. If you\'re ready to start experiencing better sleep, securing your REM patches today would ensure you lock in those savings."',
        "Summary Close": '"With the REM patch, you\'ll be getting a 100% drug-free, non-invasive solution that helps you fall asleep faster, stay asleep longer, and wake up feeling truly refreshed. How does that sound as a path to finally getting the sleep you deserve?"',
        "Referral Close": '"Even if the REM patch isn\'t the perfect fit for you right now, who else do you know who might be struggling with sleep or looking for a natural way to improve their rest?"'
    }
})

# ============ ROCKET ============
add_scripts("Rocket", "Men's Health", {
    "Opening": {
        "Cold Approach": '"Hi there! I couldn\'t help but notice [something positive about them]. My name is [Your Name], just wanted to say hello! How\'s your day going?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! So good to connect. I was just thinking about you and wanted to check in. How have things been lately? I\'ve been really excited about something new that\'s been making a huge difference for people, and I immediately thought of you."',
        "Social Media DM": '"Hey [Their Name]! I\'ve been following your [posts about fitness/positive outlook] and I really admire your dedication. Have you ever looked into natural ways to boost your overall energy and vitality, especially with such an active lifestyle?"',
        "Referral Introduction": '"Hi [Their Name], my name is [Your Name]. [Referral Name] suggested I reach out, and they spoke so highly of you! They mentioned you\'re someone who really values staying active and optimizing your health. Would you be open to a brief chat about innovative, natural ways to enhance your energy and well-being?"',
        "Event/Party Approach": '"Hey, I\'m [Your Name]! What a great event! Are you enjoying yourself? I often meet people who are really driven and active. I\'m curious, what do you do to keep your energy levels up and stay on top of your game?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''"A lot of men I talk to, especially those who are driven and want to stay at the top of their game, often tell me they struggle with a few common things. They feel that afternoon slump, a general lack of energy that makes it hard to stay focused, or maybe they just don't feel that same spark of vitality they once had. It's frustrating when you want to be fully present for your family, excel at work, or simply enjoy your passions, but your body isn't quite keeping up.

That's exactly why I'm excited about the Super Patch Rocket. Imagine a completely natural, drug-free way to tap into your body's own power to enhance your vitality, boost your energy, and elevate your overall well-being. Rocket uses Vibrotactile Technology – a small patch with specialized patterns that gently interact with your skin to trigger your body's natural neural responses.

With Rocket, men are reporting feeling more energized, mentally clearer, and experiencing a renewed sense of drive and confidence. It's non-invasive, incredibly easy to use, and works *with* your body, not against it."'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that money is an important factor. What other criteria will be used in taking this decision, beyond just the initial cost?"',
        "Need to Think": '"I understand this is a significant decision for your health. What specific questions or considerations are on your mind as you think it over?"',
        "Talk to Spouse": '"I understand this is an important decision. What specific aspects about Rocket do you think your spouse would be most interested in discussing, or what concerns might they have?"',
        "Does it Work": '"I completely understand why you\'d want to be sure. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve had experiences with other products that didn\'t deliver. What specifically didn\'t you like or what was missing from those other solutions?"',
        "Not Interested": '"I understand you might not be looking for something new right now. Could you share what led you to that conclusion, or what aspects of your current well-being you feel are already well managed?"',
        "No Time": '"I understand that you have a busy schedule. What\'s currently taking up most of your time, and what would it mean for you if you had more consistent energy to tackle everything on your plate?"',
        "Competitor Comparison": '"What have you learned or experienced about [competitor] that you found appealing or noteworthy?"'
    },
    "Closing": {
        "Assumptive Close": '"Great! Since Rocket aligns perfectly with your goal of [boosting your energy and feeling more vital], we can get you started right away. Which pack would you prefer, the 30-day supply or the 90-day value pack?"',
        "Alternative Close": '"Would you like to start with the foundational 30-day program to experience the benefits, or jump straight to the 90-day pack for the best value and sustained results?"',
        "Urgency Close": '"This week, we have a special promotion where you get [bonus/discount] when you start with Rocket today. This offer ends [Date/Time]. Shall we go ahead and secure that for you now?"',
        "Summary Close": '"We\'ve talked about how Rocket can help you overcome [pain point] and boost your [benefit], all through a natural, non-invasive technology. You mentioned how important it is for you to [reiterate their core desire]. Given all that, are you ready to start feeling more energized and vital with Rocket?"',
        "Referral Close": '"Congratulations on making this investment! As you start feeling these amazing benefits, who else do you know – a friend, family member, or colleague – who could also benefit from enhanced energy and vitality?"'
    }
})

# ============ VICTORY ============
add_scripts("Victory", "Athletic Performance", {
    "Opening": {
        "Cold Approach": '"Hey there! I couldn\'t help but notice your incredible focus/intensity on that last set. It\'s inspiring! What kind of training are you into these days?" (Then) "I\'m [Your Name], and I actually help athletes unlock even more of their potential. Have you ever explored innovative, drug-free ways to boost your strength and endurance?"',
        "Warm Introduction": '"Hey [Friend\'s Name]! How\'s your [running/gym routine/sport] going? I\'ve been so excited to tell you about something I\'ve started using that\'s totally changed my game. I think you\'d be really impressed with what it could do for your [specific goal]."',
        "Social Media DM": '"Hey [Name]! Loved seeing your recent post about [their workout/race/achievement] – super impressive! I noticed you\'re really dedicated to your fitness. I work with a lot of athletes who are looking for that extra edge to smash their personal bests, naturally. Have you ever considered drug-free, non-invasive tech to enhance your strength, endurance, and agility?"',
        "Referral Introduction": '"Hi [Prospect\'s Name], it\'s [Your Name]. [Referral Name] mentioned you\'re really committed to your [sport/fitness goals] and always looking for ways to improve. They thought you\'d be interested in what I do, which is helping athletes enhance their performance naturally with our Super Patch Victory. What are some of your biggest goals or challenges in your training right now?"',
        "Event/Party Approach": '"That\'s a great [watch/shirt/piece of gear]! Are you into [running/cycling/fitness] by any chance? I\'m [Your Name]. I meet a lot of people who are passionate about pushing their limits. What\'s one area of your fitness you\'re really focused on improving this year?"'
    },
    "Presentation": {
        "Problem-Agitate-Solve": '''"You know, a lot of dedicated athletes and fitness enthusiasts I talk to share similar frustrations. They're pushing hard, putting in the hours, but they often hit plateaus, feel like their recovery is too slow, or just wish they had that extra burst of strength or stamina when it really counts. It's incredibly frustrating to know you have more in you, but your body just isn't quite keeping up."

"That's exactly why I'm excited about the Super Patch Victory. Imagine being able to unlock more of your body's own natural power. Victory isn't a drug or a supplement; it uses Vibrotactile Technology – specialized patterns that simply interact with your skin. This interaction gently signals your body to optimize its neural responses, helping you naturally enhance your strength, boost your endurance, and improve your agility."

"It's 100% drug-free, all-natural, and completely non-invasive. So instead of feeling held back, you're experiencing faster recovery, more explosive power, and the stamina to go stronger for longer. How does the idea of achieving those kinds of results, naturally, resonate with you?"'''
    },
    "Objection Handling": {
        "Too Expensive": '"I understand that cost is an important factor when investing in your health and performance. What other criteria are most important for you when deciding on a solution that helps you reach your fitness goals?"',
        "Need to Think": '"I understand this is a significant decision for your health and performance. What specific questions or considerations are on your mind that would be most helpful for you to think through?"',
        "Talk to Spouse": '"I understand this is an important decision for your well-being. What specific questions or concerns do you anticipate your spouse might have that we could address together now?"',
        "Does it Work": '"I completely understand why you might be skeptical about new technologies. What would you need to see, hear, or experience to truly feel that this is a credible solution for you?"',
        "Tried Before": '"I understand you\'ve had experiences with other products. What specifically about those past experiences left you feeling disappointed, and what kind of results were you hoping for?"',
        "Not Interested": '"I understand you might not be actively looking for new solutions. Could you share what led you to that conclusion, or what aspects of your current routine are working really well?"',
        "No Time": '"I understand your schedule is packed. What part of your routine or day feels most constrained, and what kind of time commitment are you thinking this might require?"',
        "Competitor Comparison": '"I understand you\'re curious about how Victory stands out. What have you heard or experienced about [competitor] that makes you ask?"'
    },
    "Closing": {
        "Assumptive Close": '"Great! Based on what we\'ve discussed, it sounds like the Victory patch is exactly what you need to boost your endurance and smash those personal bests. Shall we get you started with the 30-day performance pack today?"',
        "Alternative Close": '"Considering your goals to improve both strength and agility, would you prefer to start with the single pack to try it out, or go with the triple pack for a full two-month supply and better value?"',
        "Urgency Close": '"This week, we have a special promotion where new customers receive a bonus recovery guide with their first order. This offer wraps up on Friday. Does getting started by then work for you?"',
        "Summary Close": '"We\'ve talked about how Victory can help you overcome those plateaus, significantly improve your recovery, and give you that extra edge in strength and agility – all naturally and drug-free. Are you ready to experience the difference for yourself?"',
        "Benefit Close": '"Imagine hitting your next personal best in just a few weeks, feeling stronger and recovering faster. If starting today means you\'re on track to achieve that, does it make sense to move forward?"'
    }
})

# Create DataFrame and save to Excel
df = pd.DataFrame(data)

# Sort by Patch Name, Script Type
df = df.sort_values(['Patch Name', 'Script Type', 'Sub-Type'])

# Save to Excel with formatting
output_path = "/Users/cbsuperpatch/Desktop/SalesEnablement/sales_materials/SuperPatch_Sales_Scripts.xlsx"

with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
    df.to_excel(writer, index=False, sheet_name='All Scripts')
    
    # Auto-adjust column widths
    worksheet = writer.sheets['All Scripts']
    for idx, col in enumerate(df.columns):
        max_length = max(df[col].astype(str).map(len).max(), len(col)) + 2
        if col == 'Script':
            max_length = min(max_length, 100)  # Cap script column width
        worksheet.column_dimensions[chr(65 + idx)].width = min(max_length, 50)

print(f"Excel file created: {output_path}")
print(f"Total scripts: {len(df)}")
print(f"\nScripts per patch:")
print(df.groupby('Patch Name').size())
