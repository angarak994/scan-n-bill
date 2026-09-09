with open("src/app/dashboard/page.tsx", "r") as f:
    text = f.read()

def check_balance(text, open_char, close_char):
    count = 0
    for i, c in enumerate(text):
        if c == open_char: count += 1
        elif c == close_char: count -= 1
        if count < 0:
            print(f"Unmatched {close_char} at index {i}")
            # return
    print(f"Balance of {open_char}{close_char}: {count}")

check_balance(text, '{', '}')
check_balance(text, '(', ')')
check_balance(text, '<', '>')

