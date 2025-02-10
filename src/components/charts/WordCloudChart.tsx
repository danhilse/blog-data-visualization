import React, { useState, useEffect } from 'react';
import { Text } from '@visx/text';
import { scaleLog } from '@visx/scale';
import Wordcloud from '@visx/wordcloud/lib/Wordcloud';

export interface WordData {
  text: string;
  value: number;
}

function validateAndCleanText(text: string): string {
    if (!text?.trim()) {
      throw new Error('Empty or invalid text content');
    }
    return text
      .trim()
      .replace(/[\r\n]+/g, ' ')    // Replace newlines with spaces
      .replace(/\s+/g, ' ');       // Normalize spaces
  }

const colors = ['#143059', '#2F6B9A', '#82a6c2'];
const stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
  'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an',
  'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
  'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'can', 'like',
  'time', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your',
  'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
  'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after',
  'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new',
  'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'are', 'has']);

  function wordFreq(text: string): WordData[] {
    try {
      const cleanedText = validateAndCleanText(text);
      const words = cleanedText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')  // Keep hyphens for compound words
        .split(/\s+/)
        .filter(word => 
          word &&
          !stopWords.has(word) &&
          word.length > 2 &&
          !/^\d+$/.test(word)      // Remove pure numbers
        );
  
      const freqMap: Record<string, number> = {};
      for (const word of words) {
        freqMap[word] = (freqMap[word] || 0) + 1;
      }
  
      return Object.entries(freqMap)
        .map(([text, value]) => ({ text, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 150);
    } catch (error) {
      console.error('Error processing text:', error);
      return [];
    }
  }

function getRotationDegree() {
  const rand = Math.random();
  const degree = rand > 0.5 ? 60 : -60;
  return rand * degree;
}

const WordCloudChart = () => {
  const [words, setWords] = useState<WordData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContent() {
      try {
        const response = await fetch('/data/combined_content.txt');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const processedWords = wordFreq(text);
        if (processedWords.length === 0) {
          console.warn('No valid words found in content');
        }
        setWords(processedWords);
      } catch (error) {
        console.error('Error loading content:', error);
        setWords([]);
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (words.length === 0) {
    return <div className="flex items-center justify-center h-full">No words to display</div>;
  }

  const fontScale = scaleLog({
    domain: [
      Math.min(...words.map((w) => w.value)),
      Math.max(...words.map((w) => w.value))
    ],
    range: [16, 80],
  });

  const fontSizeSetter = (datum: WordData) => fontScale(datum.value);

  return (
    <div className="w-full h-full flex items-center justify-center">
    <Wordcloud
      words={words}
      width={window.innerWidth}
      height={900}
      fontSize={fontSizeSetter}
      font={'Inter'}
      padding={2}
      spiral="rectangular"
      rotate={getRotationDegree}
    >
        {(cloudWords) =>
          cloudWords.map((w, i) => (
            <Text
              key={w.text}
              fill={colors[i % colors.length]}
              textAnchor="middle"
              transform={`translate(${w.x}, ${w.y}) rotate(${w.rotate})`}
              fontSize={w.size}
              fontFamily={w.font}
            >
              {w.text}
            </Text>
          ))
        }
      </Wordcloud>
    </div>
  );
};

export default WordCloudChart;