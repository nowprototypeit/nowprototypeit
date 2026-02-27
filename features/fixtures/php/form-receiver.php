<!doctype HTML>
<html>
<head><title>Basic form example</title></head>
<body>
  <?php if (isset($userInput['name']) && !empty($userInput['name'])) { ?>
    <h1>Hello <?php echo htmlspecialchars($userInput['name']); ?></h1>
  <?php } else { ?>
    <h1>Hello new user</h1>
  <?php } ?>
  <?php if (isset($userInput['details']['age'])) { ?>
    <p>You are <?php echo htmlspecialchars($userInput['details']['age']); ?> years old</p>
  <?php } ?>
  <?php if (isset($userInput['details']['city']) && !empty($userInput['details']['city'])) { ?>
    <p>You live in <?php echo htmlspecialchars($userInput['details']['city']); ?></p>
  <?php } ?>

<hr/>
<form method="post">
  <label for="name">Name</label>
  <input id="name" name="name" type="text" value="<?php echo $userInput['name'] ?>"/>
  <br/>
  <label for="age">Age</label>
  <input id="age" name="details[age]" type="number" value="<?php if (isset($userInput['details'])) { echo $userInput['details']['age']; } ?>"/>
  <br/>
  <label for="city">City</label>
  <input id="city" name="details[city]" type="text" value="<?php if (isset($userInput['details'])) { echo $userInput['details']['city']; } ?>"/>
  <br/>
  <button type="submit">Submit</button>
</body>
</html>
