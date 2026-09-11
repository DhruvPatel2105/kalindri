/**
 * One valid and one deliberately-malformed payload per QuestionType, used by
 * the schema tests. `satisfies Record<QuestionType, ...>` means a new type
 * without fixtures here fails typecheck the same way a missing schema does.
 *
 * Not exported for app code — test data only.
 */

import type { QuestionType } from "@/lib/questions/types";

/** Builds an N-word string ("word1 word2 ... wordN") for length-bound fields. */
function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i + 1}`).join(" ");
}

export interface Fixture {
  valid: unknown;
  invalid: unknown;
}

export const fixtures = {
  READ_ALOUD: {
    valid: {
      text: words(55),
      prep_seconds: 35,
      record_seconds: 40,
      model_audio_url: "https://cdn.example.com/audio/read-aloud-1.mp3",
      difficulty: "medium",
    },
    invalid: {
      text: words(10), // below the 50-70 word range
      prep_seconds: 35,
      record_seconds: 40,
      model_audio_url: "https://cdn.example.com/audio/read-aloud-1.mp3",
      difficulty: "medium",
    },
  },

  REPEAT_SENTENCE: {
    valid: {
      sentence_text: words(10),
      audio_url: "https://cdn.example.com/audio/repeat-sentence-1.mp3",
      accent: "en-CA",
      record_seconds: 15,
    },
    invalid: {
      sentence_text: words(3), // below the 8-12 word range
      audio_url: "https://cdn.example.com/audio/repeat-sentence-1.mp3",
      accent: "en-CA",
      record_seconds: 15,
    },
  },

  DESCRIBE_IMAGE: {
    valid: {
      image_url: "https://cdn.example.com/img/describe-image-1.png",
      image_type: "bar",
      key_points: ["overall upward trend", "sharp rise in 2024", "conclusion: sustained growth"],
      model_answer: "The bar chart shows a steady increase...",
      prep_seconds: 25,
      record_seconds: 40,
    },
    invalid: {
      image_url: "https://cdn.example.com/img/describe-image-1.png",
      image_type: "bar",
      model_answer: "The bar chart shows a steady increase...",
      prep_seconds: 25,
      record_seconds: 40,
      // key_points omitted
    },
  },

  RESPOND_TO_SITUATION: {
    valid: {
      situation_text: "Your neighbour's music is keeping you awake at night.",
      audio_url: "https://cdn.example.com/audio/respond-1.mp3",
      register: "informal",
      key_points: ["acknowledge the issue", "make a specific, polite request"],
      model_answer: "Hi, I hope you're doing well...",
      prep_seconds: 20,
      record_seconds: 40,
    },
    invalid: {
      situation_text: "Your neighbour's music is keeping you awake at night.",
      audio_url: "https://cdn.example.com/audio/respond-1.mp3",
      register: "informal",
      model_answer: "Hi, I hope you're doing well...",
      prep_seconds: 20,
      record_seconds: 40,
      // key_points omitted
    },
  },

  ANSWER_SHORT_QUESTION: {
    valid: {
      question_text: "What do we call a doctor who treats animals?",
      audio_url: "https://cdn.example.com/audio/asq-1.mp3",
      accepted_answers: ["vet", "veterinarian"],
      record_seconds: 10,
    },
    invalid: {
      question_text: "What do we call a doctor who treats animals?",
      audio_url: "https://cdn.example.com/audio/asq-1.mp3",
      accepted_answers: [], // must include at least one
      record_seconds: 10,
    },
  },

  SUMMARIZE_WRITTEN_TEXT: {
    valid: {
      passage: words(240),
      key_points: ["cause of the delay", "who is affected", "the proposed fix"],
      model_answer: "The passage explains that...",
      time_limit_seconds: 600,
    },
    invalid: {
      passage: words(240),
      model_answer: "The passage explains that...",
      time_limit_seconds: 600,
      // key_points omitted
    },
  },

  WRITE_EMAIL: {
    valid: {
      scenario: "Your apartment's heating has stopped working.",
      bullet_points: [
        "explain what is wrong",
        "say how long it has been broken",
        "ask for a repair date",
      ],
      recipient: "property manager",
      register: "formal",
      model_answer: "Dear Property Manager,...",
      time_limit_seconds: 540,
    },
    invalid: {
      scenario: "Your apartment's heating has stopped working.",
      bullet_points: ["explain what is wrong", "ask for a repair date"], // must be exactly 3
      recipient: "property manager",
      register: "formal",
      model_answer: "Dear Property Manager,...",
      time_limit_seconds: 540,
    },
  },

  FIB_RW: {
    valid: {
      passage_with_blanks:
        "The city council {{1}} the proposal after a {{2}} review.",
      blanks: [
        { index: 1, options: ["approved", "rejected", "delayed", "ignored"], correct_option: "approved" },
        { index: 2, options: ["brief", "lengthy", "informal", "private"], correct_option: "lengthy" },
      ],
    },
    invalid: {
      passage_with_blanks:
        "The city council {{1}} the proposal after a {{2}} review.",
      blanks: [
        { index: 1, options: ["approved", "rejected", "delayed", "ignored"], correct_option: "withdrawn" }, // not in options
        { index: 2, options: ["brief", "lengthy", "informal", "private"], correct_option: "lengthy" },
      ],
    },
  },

  MCM_READING: {
    valid: {
      passage: "A short passage about municipal recycling rules...",
      question: "Which two materials are accepted curbside?",
      options: [
        { id: "a", text: "Glass bottles" },
        { id: "b", text: "Cardboard" },
        { id: "c", text: "Styrofoam" },
      ],
      correct_option_ids: ["a", "b"],
    },
    invalid: {
      passage: "A short passage about municipal recycling rules...",
      question: "Which two materials are accepted curbside?",
      options: [
        { id: "a", text: "Glass bottles" },
        { id: "b", text: "Cardboard" },
        { id: "c", text: "Styrofoam" },
      ],
      correct_option_ids: ["a", "z"], // "z" is not an option id
    },
  },

  REORDER_PARAGRAPH: {
    valid: {
      boxes: [
        "First, the committee reviewed the budget.",
        "Then it identified three areas to cut.",
        "Finally, it submitted the revised plan.",
      ],
    },
    invalid: {
      boxes: ["Only one box."], // below minimum of 2
    },
  },

  FIB_READING: {
    valid: {
      passage_with_blanks: "The store {{1}} at 9am and {{2}} at 6pm.",
      word_bank: ["opens", "closes", "opened", "closed"],
      correct_answers: ["opens", "closes"],
    },
    invalid: {
      passage_with_blanks: "The store {{1}} at 9am and {{2}} at 6pm.",
      word_bank: ["opens", "closes", "opened", "closed"],
      correct_answers: ["opens", "shuts"], // "shuts" is not in word_bank
    },
  },

  MCS_READING: {
    valid: {
      passage: "A short passage about a community garden...",
      question: "What is the main purpose of the garden?",
      options: [
        { id: "a", text: "To grow food for local food banks" },
        { id: "b", text: "To host weddings" },
      ],
      correct_option_id: "a",
    },
    invalid: {
      passage: "A short passage about a community garden...",
      question: "What is the main purpose of the garden?",
      options: [
        { id: "a", text: "To grow food for local food banks" },
        { id: "b", text: "To host weddings" },
      ],
      correct_option_id: "z", // not an option id
    },
  },

  SUMMARIZE_SPOKEN_TEXT: {
    valid: {
      transcript: "A short talk about public transit changes...",
      audio_url: "https://cdn.example.com/audio/sst-1.mp3",
      accent: "en-CA",
      key_points: ["new bus route", "fare change", "start date"],
      model_answer: "The speaker explains that...",
      time_limit_seconds: 600,
    },
    invalid: {
      transcript: "A short talk about public transit changes...",
      audio_url: "https://cdn.example.com/audio/sst-1.mp3",
      accent: "en-CA",
      model_answer: "The speaker explains that...",
      time_limit_seconds: 600,
      // key_points omitted
    },
  },

  MCM_LISTENING: {
    valid: {
      transcript: "A short conversation about a library programme...",
      audio_url: "https://cdn.example.com/audio/mcm-l-1.mp3",
      accent: "en-CA",
      question: "Which two services does the library offer?",
      options: [
        { id: "a", text: "Free wifi" },
        { id: "b", text: "3D printing" },
        { id: "c", text: "Dry cleaning" },
      ],
      correct_option_ids: ["a", "b"],
    },
    invalid: {
      transcript: "A short conversation about a library programme...",
      audio_url: "https://cdn.example.com/audio/mcm-l-1.mp3",
      accent: "en-CA",
      question: "Which two services does the library offer?",
      options: [
        { id: "a", text: "Free wifi" },
        { id: "b", text: "3D printing" },
        { id: "c", text: "Dry cleaning" },
      ],
      correct_option_ids: ["a", "z"], // "z" is not an option id
    },
  },

  FIB_LISTENING: {
    valid: {
      transcript: "The meeting has been moved to Thursday afternoon.",
      audio_url: "https://cdn.example.com/audio/fib-l-1.mp3",
      blank_word_indices: [2, 6],
    },
    invalid: {
      transcript: "The meeting has been moved to Thursday afternoon.",
      audio_url: "https://cdn.example.com/audio/fib-l-1.mp3",
      blank_word_indices: [], // must have at least one
    },
  },

  MCS_LISTENING: {
    valid: {
      transcript: "A short announcement about a road closure...",
      audio_url: "https://cdn.example.com/audio/mcs-l-1.mp3",
      accent: "en-CA",
      question: "Which street is closed?",
      options: [
        { id: "a", text: "Main Street" },
        { id: "b", text: "King Street" },
      ],
      correct_option_id: "a",
    },
    invalid: {
      transcript: "A short announcement about a road closure...",
      audio_url: "https://cdn.example.com/audio/mcs-l-1.mp3",
      accent: "en-CA",
      question: "Which street is closed?",
      options: [
        { id: "a", text: "Main Street" },
        { id: "b", text: "King Street" },
      ],
      correct_option_id: "z", // not an option id
    },
  },

  SELECT_MISSING_WORD: {
    valid: {
      transcript: "The train will arrive in approximately ten...",
      missing_word_position: 6,
      options: [
        { id: "a", text: "minutes" },
        { id: "b", text: "hours" },
      ],
      correct_option_id: "a",
    },
    invalid: {
      transcript: "The train will arrive in approximately ten...",
      missing_word_position: 6,
      options: [
        { id: "a", text: "minutes" },
        { id: "b", text: "hours" },
      ],
      correct_option_id: "z", // not an option id
    },
  },

  HIGHLIGHT_INCORRECT_WORDS: {
    valid: {
      true_transcript: "The library closes at eight on weekdays.",
      altered_transcript: "The library opens at eight on weekends.",
      altered_word_indices: [2, 6],
    },
    invalid: {
      true_transcript: "The library closes at eight on weekdays.",
      altered_transcript: "The library opens at eight on weekends.",
      altered_word_indices: [], // must have at least one
    },
  },

  WRITE_FROM_DICTATION: {
    valid: {
      sentence_text: words(10),
      audio_url: "https://cdn.example.com/audio/dictation-1.mp3",
      accent: "en-CA",
    },
    invalid: {
      sentence_text: words(3), // below the 8-12 word range
      audio_url: "https://cdn.example.com/audio/dictation-1.mp3",
      accent: "en-CA",
    },
  },
} satisfies Record<QuestionType, Fixture>;
