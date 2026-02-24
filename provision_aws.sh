#!/bin/bash
set -e

# Setup environment variables using the provided keys if they aren't somehow set
export AWS_DEFAULT_REGION="ap-southeast-1"

echo "1. Creating SSH Key Pair..."
mkdir -p ~/.ssh
# Delete if exists to avoid error
aws ec2 delete-key-pair --key-name elixopay_prod > /dev/null 2>&1 || true
rm -f ~/.ssh/elixopay_prod.pem || true
aws ec2 create-key-pair --key-name elixopay_prod --query "KeyMaterial" --output text > ~/.ssh/elixopay_prod.pem
chmod 400 ~/.ssh/elixopay_prod.pem
echo "Key pair elixopay_prod saved to ~/.ssh/elixopay_prod.pem"

echo "2. Finding Default VPC..."
VPC_ID=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query "Vpcs[0].VpcId" --output text)
echo "Using VPC: $VPC_ID"

echo "3. Setting up EC2 App Security Group (elixopay-app-sg)..."
# Delete if exists
aws ec2 delete-security-group --group-name elixopay-app-sg > /dev/null 2>&1 || true
APP_SG_ID=$(aws ec2 create-security-group --group-name elixopay-app-sg --description "SG for Elixopay Node.js App Server" --vpc-id $VPC_ID --query "GroupId" --output text)
echo "App SG Created: $APP_SG_ID"

# Add inbound rules for API server (22, 80, 443, 3000)
aws ec2 authorize-security-group-ingress --group-id $APP_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $APP_SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $APP_SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $APP_SG_ID --protocol tcp --port 8080 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $APP_SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0

echo "4. Finding latest Ubuntu 24.04 LTS AMI..."
AMI_ID=$(aws ec2 describe-images --owners 099720109477 --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" "Name=state,Values=available" --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text)
echo "Using AMI: $AMI_ID"

echo "5. Launching EC2 Instance..."
INSTANCE_ID=$(aws ec2 run-instances --image-id $AMI_ID --count 1 --instance-type t3.micro --key-name elixopay_prod --security-group-ids $APP_SG_ID --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=elixopay-app-server}]' --query "Instances[0].InstanceId" --output text)
echo "Launched EC2 Instance: $INSTANCE_ID"

echo "6. Setting up RDS Database Security Group (elixopay-db-sg)..."
aws ec2 delete-security-group --group-name elixopay-db-sg > /dev/null 2>&1 || true
DB_SG_ID=$(aws ec2 create-security-group --group-name elixopay-db-sg --description "SG for Elixopay PostgreSQL DB" --vpc-id $VPC_ID --query "GroupId" --output text)

echo "Adding rule to allow App SG ($APP_SG_ID) to talk to DB SG ($DB_SG_ID) on port 5432..."
aws ec2 authorize-security-group-ingress --group-id $DB_SG_ID --protocol tcp --port 5432 --source-group $APP_SG_ID

echo "7. Launching RDS PostgreSQL Database (Free Tier)..."
aws rds delete-db-instance --db-instance-identifier elixopay-db --skip-final-snapshot > /dev/null 2>&1 || true
# wait if deleting...
echo "Creating RDS... this is an async operation on AWS side."
aws rds create-db-instance \
    --db-instance-identifier elixopay-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 16 \
    --master-username postgres \
    --master-user-password "ElixopaySecureDB2026!" \
    --allocated-storage 20 \
    --vpc-security-group-ids $DB_SG_ID \
    --no-publicly-accessible \
    --backup-retention-period 7 \
    --tags Key=Name,Value=elixopay-database

echo "========================================="
echo "Infrastructure Provisioning Initialized!"
echo "EC2 Instance ID: $INSTANCE_ID"
echo "RDS DB Identifier: elixopay-db"
echo "========================================="
