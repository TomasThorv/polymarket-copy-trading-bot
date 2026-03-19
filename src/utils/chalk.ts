type Formatter = ((text: string) => string) & {
    bold: (text: string) => string;
    underline: (text: string) => string;
};

const RESET = '\u001b[0m';

const applyCodes = (text: string, codes: number[]): string => {
    if (!text) {
        return text;
    }

    const open = codes.map((code) => `\u001b[${code}m`).join('');
    return `${open}${text}${RESET}`;
};

const createFormatter = (colorCode: number): Formatter => {
    const formatter = ((text: string) => applyCodes(text, [colorCode])) as Formatter;
    formatter.bold = (text: string) => applyCodes(text, [1, colorCode]);
    formatter.underline = (text: string) => applyCodes(text, [4, colorCode]);
    return formatter;
};

const chalk = {
    blue: createFormatter(34),
    cyan: createFormatter(36),
    dim: (text: string) => applyCodes(text, [2]),
    gray: createFormatter(90),
    green: createFormatter(32),
    magenta: createFormatter(35),
    red: createFormatter(31),
    white: createFormatter(37),
    yellow: createFormatter(33),
};

export default chalk;